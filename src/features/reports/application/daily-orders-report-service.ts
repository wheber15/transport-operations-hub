import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { Prisma, ReportArtifactFormat } from "@/generated/prisma/client";

import { irelandBusinessDate } from "@/lib/business-date";
import { resolveGoodsIssueDateScope } from "@/features/orders/domain/goods-issue-date";
import {
  exceptionSnapshot,
  kpiSnapshot,
  normalizeDailyOrdersSnapshotRows,
} from "@/features/reports/domain/daily-orders-snapshot";
import { dailyOrdersReportTemplateVersion } from "@/features/reports/domain/daily-orders-report";
import {
  canonicalJson,
  dailyOrdersDatasetVersion,
  dailyOrdersSnapshotSchemaVersion,
  maximumDailyOrdersSnapshotRows,
  type CanonicalReportFilter,
} from "@/features/reports/domain/report-run";
import {
  dailyOrdersReportFiltersSchema,
  type DailyOrdersReportFilters,
} from "@/features/reports/validation/report-schemas";
import { getDailyOrdersReportData } from "@/features/reports/infrastructure/daily-orders-report-repository";
import {
  createPendingDailyOrdersRun,
  getCompletedReportArtifact,
  listReportHistory as listReportHistoryFromRepository,
  markReportRunFailed,
  persistDailyOrdersSnapshot,
  beginDailyOrdersXlsxGeneration,
  completeDailyOrdersXlsxArtifact,
  failDailyOrdersXlsxArtifact,
  ReportArtifactStateError,
  deleteReportRun,
  getReportForDeletion,
} from "@/features/reports/infrastructure/report-run-repository";
import {
  getLocalReportArtifactStorage,
  type ReportArtifactStorage,
} from "@/features/reports/infrastructure/local-report-artifact-storage";
import { renderDailyOrdersXlsx } from "@/features/reports/infrastructure/daily-orders-xlsx-renderer";
import {
  dailyOrdersXlsxContentType,
  dailyOrdersXlsxFileName,
  maximumDailyOrdersXlsxRows,
  parseStoredDailyOrdersExceptions,
  parseStoredDailyOrdersKpis,
  parseStoredDailyOrdersRow,
  sha256,
} from "@/features/reports/domain/daily-orders-xlsx";

export class ReportRecordStateForbiddenError extends Error {
  constructor() {
    super("You do not have permission to view deleted Orders in reports.");
  }
}

export class ReportsAccessForbiddenError extends Error {
  constructor() {
    super("You do not have permission to access Reports.");
  }
}

export class ReportScopeRequiredError extends Error {
  constructor() {
    super("A complete report date range is required.");
  }
}

export class ReportDatasetTooLargeError extends Error {
  constructor() {
    super("This report exceeds the current safe snapshot limit.");
  }
}

export class ReportSnapshotFailedError extends Error {
  constructor() {
    super("The report snapshot could not be completed.");
  }
}
export class ReportXlsxFailedError extends Error {
  constructor() {
    super("The Excel report could not be generated.");
  }
}
export class ReportXlsxUnavailableError extends Error {
  constructor(public readonly reason: "NOT_ELIGIBLE" | "IN_PROGRESS" | "ALREADY_COMPLETED") {
    super("The Excel report is not available for this operation.");
  }
}
export class ReportDeleteForbiddenError extends Error {
  constructor() {
    super("You do not have permission to delete reports.");
  }
}
export class ReportDeleteUnavailableError extends Error {
  constructor() {
    super("This report cannot be deleted while generation is in progress.");
  }
}

type ReportActor = { id: string; displayName: string; role: string | null };

function requireReportsAccess(actor: { role: string | null }) {
  if (actor.role !== "Planner" && actor.role !== "Administrator") {
    throw new ReportsAccessForbiddenError();
  }
}

export function getValidatedDailyOrdersReportFilters(input: unknown): DailyOrdersReportFilters {
  const filters = dailyOrdersReportFiltersSchema.parse(input);
  const scope = resolveGoodsIssueDateScope(filters.datePreset, new Date(), {
    from: filters.from,
    to: filters.to,
  });
  return { ...filters, from: scope.from, to: scope.to };
}

export function toCanonicalDailyOrdersReportFilters(
  filters: DailyOrdersReportFilters
): CanonicalReportFilter {
  return {
    reportType: "DAILY_ORDERS",
    datePreset: filters.datePreset,
    scopeStartDate: filters.from ?? null,
    scopeEndDate: filters.to ?? null,
    query: filters.query ?? null,
    customer: filters.customer ?? null,
    route: filters.route ?? null,
    shipTo: filters.shipTo ?? null,
    carrier: filters.carrier ?? null,
    shipmentState: filters.shipmentState,
    palletState: filters.palletState,
    recordState: filters.recordState,
  };
}

function datasetChecksum(rows: ReturnType<typeof normalizeDailyOrdersSnapshotRows>) {
  return createHash("sha256").update(canonicalJson(rows), "utf8").digest("hex");
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function safeFailure(error: unknown) {
  if (error instanceof ReportDatasetTooLargeError) {
    return {
      code: "REPORT_DATASET_TOO_LARGE",
      message: "The report exceeds the current safe size limit.",
    };
  }
  return {
    code: "REPORT_SNAPSHOT_FAILED",
    message: "The report snapshot could not be completed safely.",
  };
}

export async function getDailyOrdersReport(input: unknown, actor: { role: string | null }) {
  requireReportsAccess(actor);
  const filters = getValidatedDailyOrdersReportFilters(input);
  if (filters.recordState !== "active" && actor.role !== "Administrator")
    throw new ReportRecordStateForbiddenError();
  return getDailyOrdersReportData(filters, irelandBusinessDate());
}

export async function createDailyOrdersReportSnapshot(input: unknown, actor: ReportActor) {
  requireReportsAccess(actor);
  const filters = getValidatedDailyOrdersReportFilters(input);
  if (filters.recordState !== "active" && actor.role !== "Administrator") {
    throw new ReportRecordStateForbiddenError();
  }
  if (!filters.from || !filters.to) throw new ReportScopeRequiredError();

  const referenceBusinessDate = irelandBusinessDate();
  const report = await getDailyOrdersReportData(filters, referenceBusinessDate);
  const rows = normalizeDailyOrdersSnapshotRows(report.normalizedRows);
  if (rows.length > maximumDailyOrdersSnapshotRows) throw new ReportDatasetTooLargeError();

  const canonicalFilters = toCanonicalDailyOrdersReportFilters(filters);
  const pending = await createPendingDailyOrdersRun({
    referenceBusinessDate,
    scopeStartDate: filters.from,
    scopeEndDate: filters.to,
    filters: asJson(canonicalFilters),
    kpiSnapshot: asJson(kpiSnapshot(report.kpis)),
    exceptionSummary: asJson(exceptionSnapshot(report.exceptions)),
    rowCount: rows.length,
    exceptionCount: report.exceptions.length,
    snapshotSchemaVersion: dailyOrdersSnapshotSchemaVersion,
    datasetVersion: dailyOrdersDatasetVersion,
    datasetChecksum: datasetChecksum(rows),
    templateVersion: dailyOrdersReportTemplateVersion,
    requestedBy: actor,
  });
  if (pending.duplicate) return { run: pending.duplicate, duplicate: true };
  if (!pending.created) throw new ReportSnapshotFailedError();

  try {
    const run = await persistDailyOrdersSnapshot({
      reportRunId: pending.created.id,
      actorId: actor.id,
      rows: rows.map((row) => asJson(row)),
    });
    return { run, duplicate: false };
  } catch (error) {
    try {
      await markReportRunFailed(pending.created.id, actor.id, safeFailure(error));
    } catch {
      // The planner still receives the safe snapshot failure; diagnostics remain server-side.
    }
    throw new ReportSnapshotFailedError();
  }
}

export async function listReportHistory(actor: { role: string | null }) {
  requireReportsAccess(actor);
  const runs = await listReportHistoryFromRepository();
  return runs.map((run) => ({
    ...run,
    failureCode: actor.role === "Administrator" ? run.failureCode : null,
    failureMessage: actor.role === "Administrator" ? run.failureMessage : null,
  }));
}

export async function getReportArtifactForDownload(
  actor: ReportActor,
  reportRunId: string,
  format: ReportArtifactFormat
) {
  requireReportsAccess(actor);
  const artifact = await getCompletedReportArtifact(reportRunId, format);
  if (
    !artifact?.storageKey ||
    !artifact.fileName ||
    !artifact.contentType ||
    !artifact.checksumSha256 ||
    artifact.byteSize === null
  ) {
    return null;
  }
  return {
    ...artifact,
    storageKey: artifact.storageKey,
    fileName: artifact.fileName,
    contentType: artifact.contentType,
    checksumSha256: artifact.checksumSha256,
    byteSize: artifact.byteSize,
  };
}

export async function generateDailyOrdersXlsx(
  actor: ReportActor,
  reportRunId: string,
  storage: ReportArtifactStorage = getLocalReportArtifactStorage()
) {
  requireReportsAccess(actor);
  let begun: Awaited<ReturnType<typeof beginDailyOrdersXlsxGeneration>>;
  try {
    begun = await beginDailyOrdersXlsxGeneration(reportRunId);
  } catch (error) {
    if (error instanceof ReportArtifactStateError)
      throw new ReportXlsxUnavailableError(error.reason);
    throw new ReportXlsxFailedError();
  }
  try {
    const run = begun.run;
    if (
      run.snapshotSchemaVersion !== dailyOrdersSnapshotSchemaVersion ||
      run.snapshotRows.length > maximumDailyOrdersXlsxRows
    )
      throw new Error("Unsupported report snapshot.");
    const rows = run.snapshotRows.map((row) => parseStoredDailyOrdersRow(row.normalizedPayload));
    const kpis = parseStoredDailyOrdersKpis(run.kpiSnapshot);
    const exceptions = parseStoredDailyOrdersExceptions(run.exceptionSummary);
    const filters =
      run.filters && typeof run.filters === "object" && !Array.isArray(run.filters)
        ? (run.filters as Record<string, unknown>)
        : {};
    const started = performance.now();
    const content = await renderDailyOrdersXlsx({ ...run, filters, rows, kpis, exceptions });
    const checksumSha256 = sha256(content);
    const storageKey = `reports/${run.id}/xlsx/${randomUUID()}.xlsx`;
    await storage.write({ storageKey, content, checksumSha256 });
    await completeDailyOrdersXlsxArtifact({
      artifactId: begun.artifactId,
      actorId: actor.id,
      storageKey,
      fileName: dailyOrdersXlsxFileName(run.referenceBusinessDate, run.reference),
      byteSize: BigInt(content.byteLength),
      checksumSha256,
      durationMs: Math.round(performance.now() - started),
    });
    return {
      fileName: dailyOrdersXlsxFileName(run.referenceBusinessDate, run.reference),
      contentType: dailyOrdersXlsxContentType,
    };
  } catch {
    try {
      await failDailyOrdersXlsxArtifact(begun.artifactId, actor.id, {
        code: "REPORT_XLSX_GENERATION_FAILED",
        message: "The Excel report could not be generated safely.",
      });
    } catch {
      /* retain the safe error response */
    }
    throw new ReportXlsxFailedError();
  }
}

export async function deleteReport(
  actor: ReportActor,
  reportRunId: string,
  storage: ReportArtifactStorage = getLocalReportArtifactStorage()
) {
  if (actor.role !== "Administrator") throw new ReportDeleteForbiddenError();
  const run = await getReportForDeletion(reportRunId);
  if (!run) return false;
  if (run.status === "GENERATING" || run.artifacts.some((artifact) => !artifact.storageKey))
    throw new ReportDeleteUnavailableError();
  try {
    for (const artifact of run.artifacts)
      if (artifact.storageKey) await storage.remove({ storageKey: artifact.storageKey });
    await deleteReportRun(reportRunId, actor.id);
    return true;
  } catch {
    throw new ReportXlsxFailedError();
  }
}
