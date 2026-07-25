import "server-only";

import { randomUUID } from "node:crypto";

import {
  Prisma,
  ReportArtifactFormat,
  ReportArtifactStatus,
  ReportRunStatus,
  ReportType,
} from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

import { formatDailyOrdersReference } from "@/features/reports/domain/report-run";

const reportRunSelect = {
  id: true,
  reportType: true,
  reference: true,
  referenceSequence: true,
  referenceBusinessDate: true,
  scopeStartDate: true,
  scopeEndDate: true,
  status: true,
  rowCount: true,
  exceptionCount: true,
  requestedByDisplayName: true,
  requestedByRole: true,
  generationStartedAt: true,
  generationCompletedAt: true,
  failureCode: true,
  failureMessage: true,
  createdAt: true,
  artifacts: {
    select: {
      id: true,
      format: true,
      status: true,
      fileName: true,
      contentType: true,
      byteSize: true,
      generatedAt: true,
    },
    orderBy: { format: "asc" },
  },
} satisfies Prisma.ReportRunSelect;

type ReportRunRecord = Prisma.ReportRunGetPayload<{ select: typeof reportRunSelect }>;

export type ReportHistoryItem = ReturnType<typeof toHistoryItem>;

type DailyOrdersRunInput = {
  referenceBusinessDate: string;
  scopeStartDate: string;
  scopeEndDate: string;
  filters: Prisma.InputJsonValue;
  kpiSnapshot: Prisma.InputJsonValue;
  exceptionSummary: Prisma.InputJsonValue;
  rowCount: number;
  exceptionCount: number;
  snapshotSchemaVersion: string;
  datasetVersion: string;
  datasetChecksum: string;
  templateVersion: string;
  requestedBy: { id: string; displayName: string; role: string | null };
};

type SnapshotPersistenceInput = {
  reportRunId: string;
  actorId: string;
  rows: Prisma.InputJsonValue[];
};

export class ReportArtifactStateError extends Error {
  constructor(public readonly reason: "NOT_ELIGIBLE" | "IN_PROGRESS" | "ALREADY_COMPLETED") {
    super("The Excel report is not available for this operation.");
  }
}

export class ReportRunStateError extends Error {
  constructor() {
    super("Report run is not in a state that allows this operation.");
  }
}

function asDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toHistoryItem(record: ReportRunRecord) {
  return {
    id: record.id,
    reportType: record.reportType,
    reference: record.reference,
    referenceSequence: record.referenceSequence,
    referenceBusinessDate: record.referenceBusinessDate,
    scopeStartDate: record.scopeStartDate,
    scopeEndDate: record.scopeEndDate,
    status: record.status,
    rowCount: record.rowCount,
    exceptionCount: record.exceptionCount,
    requestedByDisplayName: record.requestedByDisplayName,
    requestedByRole: record.requestedByRole,
    generationStartedAt: record.generationStartedAt,
    generationCompletedAt: record.generationCompletedAt,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    createdAt: record.createdAt,
    artifacts: record.artifacts.map((artifact) => ({
      id: artifact.id,
      format: artifact.format,
      status: artifact.status,
      fileName: artifact.fileName,
      contentType: artifact.contentType,
      byteSize: artifact.byteSize?.toString() ?? null,
      generatedAt: artifact.generatedAt,
    })),
  };
}

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function withSerializableRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSerializationFailure(error) || attempt === attempts - 1) throw error;
    }
  }
  throw lastError;
}

export async function createPendingDailyOrdersRun(input: DailyOrdersRunInput) {
  const fingerprint = `${input.datasetChecksum}:${JSON.stringify(input.filters)}`;
  return withSerializableRetry(async () =>
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${fingerprint}))`;

        const duplicate = await tx.reportRun.findFirst({
          where: {
            reportType: ReportType.DAILY_ORDERS,
            datasetChecksum: input.datasetChecksum,
            filters: { equals: input.filters },
            status: {
              in: [ReportRunStatus.PENDING, ReportRunStatus.GENERATING, ReportRunStatus.COMPLETED],
            },
          },
          select: reportRunSelect,
        });
        if (duplicate) return { duplicate: toHistoryItem(duplicate), created: null };

        const sequenceId = randomUUID();
        const sequenceRows = await tx.$queryRaw<Array<{ lastSequence: number }>>`
          INSERT INTO "report_reference_sequence" (
            "id", "reportType", "businessDate", "lastSequence", "createdAt", "updatedAt"
          )
          VALUES (${sequenceId}::uuid, ${ReportType.DAILY_ORDERS}::"ReportType", ${asDate(input.referenceBusinessDate)}::date, 1, NOW(), NOW())
          ON CONFLICT ("reportType", "businessDate")
          DO UPDATE SET "lastSequence" = "report_reference_sequence"."lastSequence" + 1, "updatedAt" = NOW()
          RETURNING "lastSequence"
        `;
        const sequence = sequenceRows[0]?.lastSequence;
        if (!sequence) throw new Error("Report reference allocation did not return a sequence.");

        const created = await tx.reportRun.create({
          data: {
            reportType: ReportType.DAILY_ORDERS,
            reference: formatDailyOrdersReference(input.referenceBusinessDate, sequence),
            referenceSequence: sequence,
            referenceBusinessDate: asDate(input.referenceBusinessDate),
            scopeStartDate: asDate(input.scopeStartDate),
            scopeEndDate: asDate(input.scopeEndDate),
            filters: input.filters,
            kpiSnapshot: input.kpiSnapshot,
            exceptionSummary: input.exceptionSummary,
            rowCount: input.rowCount,
            exceptionCount: input.exceptionCount,
            snapshotSchemaVersion: input.snapshotSchemaVersion,
            datasetVersion: input.datasetVersion,
            datasetChecksum: input.datasetChecksum,
            templateVersion: input.templateVersion,
            requestedById: input.requestedBy.id,
            requestedByDisplayName: input.requestedBy.displayName,
            requestedByRole: input.requestedBy.role ?? "Unassigned",
          },
          select: reportRunSelect,
        });
        await tx.activity.create({
          data: {
            entityType: "ReportRun",
            entityId: created.id,
            action: "report_requested",
            description: `Report ${created.reference} requested.`,
            metadata: { reportType: created.reportType, reference: created.reference },
            actorId: input.requestedBy.id,
            createdById: input.requestedBy.id,
            updatedById: input.requestedBy.id,
          },
        });
        return { duplicate: null, created: toHistoryItem(created) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

export async function persistDailyOrdersSnapshot(input: SnapshotPersistenceInput) {
  return prisma.$transaction(async (tx) => {
    const transitioned = await tx.reportRun.updateMany({
      where: { id: input.reportRunId, status: ReportRunStatus.PENDING },
      data: { status: ReportRunStatus.GENERATING, generationStartedAt: new Date() },
    });
    if (transitioned.count !== 1) throw new ReportRunStateError();

    if (input.rows.length) {
      await tx.reportSnapshotRow.createMany({
        data: input.rows.map((normalizedPayload, index) => ({
          reportRunId: input.reportRunId,
          rowSequence: index + 1,
          normalizedPayload,
          createdById: input.actorId,
        })),
      });
    }

    const completed = await tx.reportRun.update({
      where: { id: input.reportRunId },
      data: { status: ReportRunStatus.COMPLETED, generationCompletedAt: new Date() },
      select: reportRunSelect,
    });
    await tx.activity.create({
      data: {
        entityType: "ReportRun",
        entityId: completed.id,
        action: "report_snapshot_completed",
        description: `Report ${completed.reference} snapshot completed.`,
        metadata: { reportType: completed.reportType, rowCount: completed.rowCount },
        actorId: input.actorId,
        createdById: input.actorId,
        updatedById: input.actorId,
      },
    });
    return toHistoryItem(completed);
  });
}

export async function markReportRunFailed(
  reportRunId: string,
  actorId: string,
  failure: { code: string; message: string }
) {
  const failed = await prisma.$transaction(async (tx) => {
    const changed = await tx.reportRun.updateMany({
      where: {
        id: reportRunId,
        status: { in: [ReportRunStatus.PENDING, ReportRunStatus.GENERATING] },
      },
      data: {
        status: ReportRunStatus.FAILED,
        failureCode: failure.code,
        failureMessage: failure.message,
      },
    });
    if (changed.count !== 1) return null;
    const reportRun = await tx.reportRun.findUnique({
      where: { id: reportRunId },
      select: reportRunSelect,
    });
    if (!reportRun) return null;
    await tx.activity.create({
      data: {
        entityType: "ReportRun",
        entityId: reportRun.id,
        action: "report_failed",
        description: `Report ${reportRun.reference} failed safely.`,
        metadata: { reportType: reportRun.reportType, failureCode: failure.code },
        actorId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    return toHistoryItem(reportRun);
  });
  return failed;
}

export async function listReportHistory(limit = 50) {
  const runs = await prisma.reportRun.findMany({
    take: limit,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: reportRunSelect,
  });
  return runs.map(toHistoryItem);
}

export async function getCompletedReportArtifact(
  reportRunId: string,
  format: ReportArtifactFormat
) {
  const artifact = await prisma.reportArtifact.findFirst({
    where: {
      reportRunId,
      format,
      status: ReportArtifactStatus.COMPLETED,
      reportRun: { is: { status: ReportRunStatus.COMPLETED } },
    },
    select: {
      id: true,
      format: true,
      fileName: true,
      contentType: true,
      storageKey: true,
      checksumSha256: true,
      byteSize: true,
      reportRun: { select: { id: true, reference: true } },
    },
  });
  return artifact;
}

export async function beginDailyOrdersXlsxGeneration(reportRunId: string) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.reportRun.findUnique({
      where: { id: reportRunId },
      select: {
        id: true,
        reportType: true,
        status: true,
        reference: true,
        referenceBusinessDate: true,
        scopeStartDate: true,
        scopeEndDate: true,
        requestedByDisplayName: true,
        requestedByRole: true,
        createdAt: true,
        generationCompletedAt: true,
        snapshotSchemaVersion: true,
        datasetVersion: true,
        datasetChecksum: true,
        templateVersion: true,
        filters: true,
        kpiSnapshot: true,
        exceptionSummary: true,
        rowCount: true,
        snapshotRows: {
          select: { rowSequence: true, normalizedPayload: true },
          orderBy: { rowSequence: "asc" },
        },
        artifacts: {
          where: { format: ReportArtifactFormat.XLSX },
          select: { id: true, status: true },
        },
      },
    });
    if (
      !run ||
      run.reportType !== ReportType.DAILY_ORDERS ||
      run.status !== ReportRunStatus.COMPLETED
    )
      throw new ReportArtifactStateError("NOT_ELIGIBLE");
    const existing = run.artifacts[0];
    if (existing?.status === ReportArtifactStatus.COMPLETED)
      throw new ReportArtifactStateError("ALREADY_COMPLETED");
    if (
      existing?.status === ReportArtifactStatus.GENERATING ||
      existing?.status === ReportArtifactStatus.PENDING
    )
      throw new ReportArtifactStateError("IN_PROGRESS");
    if (existing?.status === ReportArtifactStatus.FAILED)
      throw new ReportArtifactStateError("NOT_ELIGIBLE");
    const artifact = await tx.reportArtifact.create({
      data: {
        reportRunId,
        format: ReportArtifactFormat.XLSX,
        status: ReportArtifactStatus.GENERATING,
      },
      select: { id: true },
    });
    return { run, artifactId: artifact.id };
  });
}

export async function completeDailyOrdersXlsxArtifact(input: {
  artifactId: string;
  actorId: string;
  storageKey: string;
  fileName: string;
  byteSize: bigint;
  checksumSha256: string;
  durationMs: number;
}) {
  return prisma.$transaction(async (tx) => {
    const artifact = await tx.reportArtifact.updateMany({
      where: { id: input.artifactId, status: ReportArtifactStatus.GENERATING },
      data: {
        status: ReportArtifactStatus.COMPLETED,
        storageKey: input.storageKey,
        fileName: input.fileName,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        byteSize: input.byteSize,
        checksumSha256: input.checksumSha256,
        generatedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
    });
    if (artifact.count !== 1) throw new ReportArtifactStateError("NOT_ELIGIBLE");
    const completed = await tx.reportArtifact.findUniqueOrThrow({
      where: { id: input.artifactId },
      select: { reportRunId: true },
    });
    await tx.activity.create({
      data: {
        entityType: "ReportRun",
        entityId: completed.reportRunId,
        action: "report_xlsx_generated",
        description: "An Excel report was generated.",
        metadata: {
          format: "XLSX",
          byteSize: input.byteSize.toString(),
          generationDurationMs: input.durationMs,
        },
        actorId: input.actorId,
        createdById: input.actorId,
        updatedById: input.actorId,
      },
    });
  });
}

export async function failDailyOrdersXlsxArtifact(
  artifactId: string,
  actorId: string,
  failure: { code: string; message: string }
) {
  await prisma.reportArtifact.updateMany({
    where: { id: artifactId, status: ReportArtifactStatus.GENERATING },
    data: {
      status: ReportArtifactStatus.FAILED,
      failureCode: failure.code,
      failureMessage: failure.message,
    },
  });
  await prisma.activity.create({
    data: {
      entityType: "ReportArtifact",
      entityId: artifactId,
      action: "report_artifact_failed",
      description: "An Excel report could not be generated.",
      metadata: { format: "XLSX", failureCode: failure.code },
      actorId,
      createdById: actorId,
      updatedById: actorId,
    },
  });
}

export async function recordArtifactDownload(
  reportRunId: string,
  actorId: string,
  format: ReportArtifactFormat
) {
  await prisma.activity.create({
    data: {
      entityType: "ReportRun",
      entityId: reportRunId,
      action: "report_artifact_downloaded",
      description: `A ${format} artifact was downloaded for a report run.`,
      metadata: { format },
      actorId,
      createdById: actorId,
      updatedById: actorId,
    },
  });
}

export async function getReportForDeletion(reportRunId: string) {
  return prisma.reportRun.findUnique({
    where: { id: reportRunId },
    select: { id: true, status: true, artifacts: { select: { storageKey: true } } },
  });
}

export async function deleteReportRun(reportRunId: string, actorId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.reportSnapshotRow.deleteMany({ where: { reportRunId } });
    await tx.reportArtifact.deleteMany({ where: { reportRunId } });
    await tx.reportRun.delete({ where: { id: reportRunId } });
    await tx.activity.create({
      data: {
        entityType: "ReportRun",
        entityId: reportRunId,
        action: "report_deleted",
        description: "A report was deleted by an Administrator.",
        metadata: {},
        actorId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
  });
}
