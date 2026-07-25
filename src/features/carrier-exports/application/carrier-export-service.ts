import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { CarrierExportStage, type Prisma } from "@/generated/prisma/client";

import { canManageCarrierExports, canMarkCarrierExportsSent } from "@/features/auth/domain/roles";
import {
  carrierExportCalculationVersion,
  carrierExportRendererVersion,
  formatCarrierExportReference,
  type CarrierExportChange,
  type CarrierExportPreviewRow,
} from "@/features/carrier-exports/domain/carrier-export-run";
import {
  datasetChecksum,
  filename,
  rowChecksum,
  sumWeightsKg,
  validateDachserRow,
  type DachserRow,
} from "@/features/carrier-exports/domain/dachser-export";
import { calculatePlannedPalletUnit } from "@/features/carrier-exports/domain/planned-pallets";
import {
  CarrierExportDuplicateError,
  completeExport,
  createPendingExport,
  failExport,
  findActiveCarrier,
  getBaselineRun,
  getCompletedArtifact,
  getCumulativeSentDeliveryNumbers,
  listHistory as listHistoryFromRepository,
  listActiveCarriers as listActiveCarriersFromRepository,
  listSourceDeliveries,
  markSent as markSentInRepository,
  recordArtifactDownload,
} from "@/features/carrier-exports/infrastructure/carrier-export-repository";
import { renderDachserXlsx } from "@/features/carrier-exports/infrastructure/dachser-xlsx-renderer";
import { getLocalCarrierExportArtifactStorage } from "@/features/carrier-exports/infrastructure/local-carrier-export-artifact-storage";
import { areOrderExportFieldsAvailable } from "@/features/orders/lib/order-export-field-gate";
import type { ReportArtifactStorage } from "@/features/reports/infrastructure/local-report-artifact-storage";
import {
  carrierExportGenerateSchema,
  carrierExportIdSchema,
  carrierExportPreviewSchema,
  type CarrierExportGenerateInput,
} from "@/features/carrier-exports/validation/carrier-export-schemas";

type CarrierExportActor = { id: string; displayName: string; role: string | null };

export class CarrierExportForbiddenError extends Error {}
export class CarrierExportFieldsUnavailableError extends Error {}
export class CarrierExportCarrierNotFoundError extends Error {}
export class CarrierExportPreviewBlockedError extends Error {
  constructor(public readonly preview: Awaited<ReturnType<typeof getCarrierExportPreview>>) {
    super("The carrier export has unresolved blockers.");
  }
}
export class CarrierExportNotFoundError extends Error {}
export class CarrierExportGenerationError extends Error {}

function requireExportAccess(actor: { role: string | null }) {
  if (!canManageCarrierExports(actor.role)) throw new CarrierExportForbiddenError();
}

function requireExportFields() {
  if (!areOrderExportFieldsAvailable()) throw new CarrierExportFieldsUnavailableError();
}

function toJson(row: DachserRow) {
  return JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
}

function toCandidateRow(row: DachserRow, carrierId: string): DachserRow {
  const totalWeightKg = row.totalWeightKg;
  return {
    ...row,
    carrierId,
    palletUnit: calculatePlannedPalletUnit(totalWeightKg),
  };
}

function classify(
  currentChecksum: string,
  deliveryNumber: string | null,
  baselineChecksums: Map<string, string>,
  stage: CarrierExportStage,
  cumulativeSent: Set<string>
): CarrierExportChange {
  if (stage === CarrierExportStage.INITIAL) return "ADDED";
  if (stage === CarrierExportStage.ADDITION) {
    return deliveryNumber && cumulativeSent.has(deliveryNumber) ? "UNCHANGED" : "ADDED";
  }
  const baselineChecksum = deliveryNumber ? baselineChecksums.get(deliveryNumber) : undefined;
  if (!baselineChecksum) return "ADDED";
  return baselineChecksum === currentChecksum ? "UNCHANGED" : "CHANGED";
}

function removedCount(currentDeliveryNumbers: Set<string>, baselineChecksums: Map<string, string>) {
  return [...baselineChecksums.keys()].filter(
    (deliveryNumber) => !currentDeliveryNumbers.has(deliveryNumber)
  ).length;
}

export async function getCarrierExportPreview(actor: CarrierExportActor, input: unknown) {
  requireExportAccess(actor);
  requireExportFields();
  const parsed = carrierExportPreviewSchema.parse(input);
  if (parsed.baselineRunId && actor.role !== "Administrator")
    throw new CarrierExportForbiddenError();
  const stage = parsed.stage as CarrierExportStage;
  const carrier = await findActiveCarrier(parsed.carrierId);
  if (!carrier) throw new CarrierExportCarrierNotFoundError();

  const [sourceResult, baseline, cumulativeSent] = await Promise.all([
    listSourceDeliveries(parsed.goodsIssueDate),
    getBaselineRun({
      baselineRunId: parsed.baselineRunId,
      carrierId: parsed.carrierId,
      goodsIssueDate: parsed.goodsIssueDate,
      stage,
    }),
    stage === CarrierExportStage.ADDITION
      ? getCumulativeSentDeliveryNumbers(parsed.carrierId, parsed.goodsIssueDate)
      : Promise.resolve(new Set<string>()),
  ]);
  const baselineChecksums = new Map(
    baseline?.rows.map((row) => [row.deliveryNumber, row.rowChecksum]) ?? []
  );
  const seenDeliveryNumbers = new Set<string>();
  const rows: CarrierExportPreviewRow[] = sourceResult.sources.map((source) => {
    const row = toCandidateRow(source.row, carrier.id);
    const duplicate = row.deliveryNumber !== null && seenDeliveryNumbers.has(row.deliveryNumber);
    if (row.deliveryNumber) seenDeliveryNumbers.add(row.deliveryNumber);
    const checksum = rowChecksum(row);
    const blockers = [
      ...(source.blockers ?? []),
      ...validateDachserRow(row),
      ...(duplicate
        ? [{ code: "DUPLICATE_DELIVERY", message: "Delivery Number appears more than once." }]
        : []),
    ];
    return {
      baselineRowChecksum: row.deliveryNumber
        ? (baselineChecksums.get(row.deliveryNumber) ?? null)
        : null,
      blockers,
      changeClassification: classify(
        checksum,
        row.deliveryNumber,
        baselineChecksums,
        stage,
        cumulativeSent
      ),
      deliveryId: source.deliveryId,
      linkedOrderCount: source.linkedOrderCount ?? 1,
      linkedOrderNumbers: source.linkedOrderNumbers ?? [],
      row,
      rowChecksum: checksum,
    };
  });
  const eligibleRows = rows.filter((item) => item.blockers.length === 0);
  const exportRows =
    stage === CarrierExportStage.ADDITION
      ? eligibleRows.filter((item) => item.changeClassification === "ADDED")
      : eligibleRows;
  const currentDeliveryNumbers = new Set(
    rows.flatMap((item) => (item.row.deliveryNumber ? [item.row.deliveryNumber] : []))
  );
  const blockers = rows.flatMap((item) =>
    item.blockers.map((blocker) => ({ deliveryNumber: item.row.deliveryNumber, ...blocker }))
  );
  const blockedDeliveries = rows
    .filter((item) => item.blockers.length > 0)
    .map((item) => ({
      deliveryNumber: item.row.deliveryNumber,
      blockers: item.blockers,
    }));
  const counts = exportRows.reduce(
    (total, item) => ({
      added: total.added + Number(item.changeClassification === "ADDED"),
      changed: total.changed + Number(item.changeClassification === "CHANGED"),
      unchanged: total.unchanged + Number(item.changeClassification === "UNCHANGED"),
    }),
    { added: 0, changed: 0, unchanged: 0 }
  );
  const totalWeightKg = sumWeightsKg(exportRows.map((item) => item.row.totalWeightKg));
  const totalPallets = exportRows.reduce((total, item) => total + (item.row.palletUnit ?? 0), 0);
  const checksum = datasetChecksum({
    carrierId: carrier.id,
    goodsIssueDate: parsed.goodsIssueDate,
    stage,
    baselineReference: baseline?.reference ?? null,
    rendererVersion: carrierExportRendererVersion,
    calculationVersion: carrierExportCalculationVersion,
    rows: exportRows.map((item) => item.row),
  });
  return {
    carrier,
    goodsIssueDate: parsed.goodsIssueDate,
    stage,
    baseline: baseline ? { id: baseline.id, reference: baseline.reference } : null,
    rows,
    exportRows,
    blockers,
    datasetChecksum: checksum,
    counts: { ...counts, removed: removedCount(currentDeliveryNumbers, baselineChecksums) },
    diagnostics: {
      ...sourceResult.excluded,
      blockedActiveDeliveries: blockedDeliveries.length,
      validationIssueCount: blockers.length,
      blockedDeliveries,
      excludedRecords: sourceResult.excludedRecords,
    },
    totalPallets,
    totalWeightKg,
  };
}

export async function generateCarrierExport(
  actor: CarrierExportActor,
  input: unknown,
  storage: ReportArtifactStorage = getLocalCarrierExportArtifactStorage()
) {
  requireExportAccess(actor);
  const parsed: CarrierExportGenerateInput = carrierExportGenerateSchema.parse(input);
  const preview = await getCarrierExportPreview(actor, parsed);
  if (!preview.exportRows.length) throw new CarrierExportPreviewBlockedError(preview);
  if (
    parsed.stage === "ADDITION" &&
    preview.exportRows.every((row) => row.changeClassification !== "ADDED")
  ) {
    throw new CarrierExportPreviewBlockedError(preview);
  }
  if (parsed.baselineRunId && preview.baseline?.id !== parsed.baselineRunId) {
    throw new CarrierExportCarrierNotFoundError();
  }

  let run: { id: string; sequence: number };
  try {
    run = await createPendingExport({
      actor: { id: actor.id, displayName: actor.displayName },
      baselineRunId: preview.baseline?.id ?? null,
      carrierId: preview.carrier.id,
      changeCounts: preview.counts,
      datasetChecksum: preview.datasetChecksum,
      goodsIssueDate: preview.goodsIssueDate,
      rows: preview.exportRows.map((item) => ({
        deliveryId: item.deliveryId,
        deliveryNumber: item.row.deliveryNumber ?? "",
        normalizedPayload: toJson(item.row),
        rowChecksum: item.rowChecksum,
        changeClassification: item.changeClassification,
        baselineRowChecksum: item.baselineRowChecksum,
      })),
      stage: preview.stage,
      totalPallets: preview.totalPallets,
      totalWeightKg: preview.totalWeightKg,
    });
  } catch (error) {
    if (error instanceof CarrierExportDuplicateError) throw error;
    throw new CarrierExportGenerationError();
  }

  const exportFilename = filename(preview.goodsIssueDate, preview.stage, run.sequence);
  const reference = formatCarrierExportReference(
    preview.goodsIssueDate,
    preview.stage,
    run.sequence
  );
  try {
    const content = await renderDachserXlsx(
      preview.exportRows.map((item) => item.row),
      {
        newDeliveryNumbers: new Set(
          preview.exportRows
            .filter((item) => item.changeClassification === "ADDED")
            .flatMap((item) => (item.row.deliveryNumber ? [item.row.deliveryNumber] : []))
        ),
      }
    );
    const checksumSha256 = createHash("sha256").update(content).digest("hex");
    const storageKey = `carrier-exports/${run.id}/xlsx/${randomUUID()}.xlsx`;
    await storage.write({ storageKey, content, checksumSha256 });
    const completed = await completeExport({
      actorId: actor.id,
      artifact: {
        byteSize: BigInt(content.byteLength),
        checksumSha256,
        fileName: exportFilename,
        storageKey,
      },
      exportRunId: run.id,
      reference,
    });
    return { id: completed.id, reference: completed.reference, filename: exportFilename };
  } catch {
    try {
      await failExport(run.id, actor.id);
    } catch {
      // Preserve a safe application error if failure audit persistence also fails.
    }
    throw new CarrierExportGenerationError();
  }
}

export async function listCarrierExportHistory(
  actor: CarrierExportActor,
  filters?: { carrierId?: string; goodsIssueDate?: string }
) {
  requireExportAccess(actor);
  requireExportFields();
  return listHistoryFromRepository(filters?.carrierId, filters?.goodsIssueDate);
}

export async function listCarrierExportCarriers(actor: CarrierExportActor) {
  requireExportAccess(actor);
  return listActiveCarriersFromRepository();
}

export async function getCarrierExportArtifact(actor: CarrierExportActor, exportRunId: unknown) {
  requireExportAccess(actor);
  const artifact = await getCompletedArtifact(carrierExportIdSchema.parse(exportRunId));
  if (
    !artifact?.storageKey ||
    !artifact.filename ||
    !artifact.contentType ||
    !artifact.checksumSha256 ||
    artifact.byteSize === null
  ) {
    throw new CarrierExportNotFoundError();
  }
  return {
    byteSize: artifact.byteSize,
    checksumSha256: artifact.checksumSha256,
    contentType: artifact.contentType,
    filename: artifact.filename,
    storageKey: artifact.storageKey,
  };
}

export async function recordCarrierExportDownload(actor: CarrierExportActor, exportRunId: unknown) {
  requireExportAccess(actor);
  await recordArtifactDownload(carrierExportIdSchema.parse(exportRunId), actor.id);
}

export async function markCarrierExportSent(actor: CarrierExportActor, exportRunId: unknown) {
  if (!canMarkCarrierExportsSent(actor.role)) throw new CarrierExportForbiddenError();
  const marked = await markSentInRepository(carrierExportIdSchema.parse(exportRunId), actor.id);
  if (!marked) throw new CarrierExportNotFoundError();
}
