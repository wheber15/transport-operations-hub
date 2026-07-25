CREATE TYPE "ReportType" AS ENUM ('DAILY_ORDERS');
CREATE TYPE "ReportRunStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');
CREATE TYPE "ReportArtifactFormat" AS ENUM ('XLSX', 'PDF');
CREATE TYPE "ReportArtifactStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

CREATE TABLE "report_reference_sequence" (
    "id" UUID NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "businessDate" DATE NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_reference_sequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_run" (
    "id" UUID NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "reference" TEXT NOT NULL,
    "referenceSequence" INTEGER NOT NULL,
    "referenceBusinessDate" DATE NOT NULL,
    "scopeStartDate" DATE NOT NULL,
    "scopeEndDate" DATE NOT NULL,
    "status" "ReportRunStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB NOT NULL,
    "kpiSnapshot" JSONB NOT NULL,
    "exceptionSummary" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "exceptionCount" INTEGER NOT NULL,
    "snapshotSchemaVersion" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "datasetChecksum" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "requestedById" UUID,
    "requestedByDisplayName" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "generationStartedAt" TIMESTAMPTZ(3),
    "generationCompletedAt" TIMESTAMPTZ(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_snapshot_row" (
    "id" UUID NOT NULL,
    "reportRunId" UUID NOT NULL,
    "rowSequence" INTEGER NOT NULL,
    "normalizedPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "report_snapshot_row_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_artifact" (
    "id" UUID NOT NULL,
    "reportRunId" UUID NOT NULL,
    "format" "ReportArtifactFormat" NOT NULL,
    "status" "ReportArtifactStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "byteSize" BIGINT,
    "checksumSha256" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "generatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_artifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_reference_sequence_reportType_businessDate_key"
  ON "report_reference_sequence"("reportType", "businessDate");
CREATE UNIQUE INDEX "report_run_reference_key" ON "report_run"("reference");
CREATE UNIQUE INDEX "report_run_reportType_referenceBusinessDate_referenceSequence_key"
  ON "report_run"("reportType", "referenceBusinessDate", "referenceSequence");
CREATE INDEX "report_run_reportType_scopeStartDate_scopeEndDate_idx"
  ON "report_run"("reportType", "scopeStartDate", "scopeEndDate");
CREATE INDEX "report_run_status_createdAt_idx" ON "report_run"("status", "createdAt");
CREATE INDEX "report_run_requestedById_createdAt_idx" ON "report_run"("requestedById", "createdAt");
CREATE INDEX "report_run_createdAt_idx" ON "report_run"("createdAt");
CREATE UNIQUE INDEX "report_snapshot_row_reportRunId_rowSequence_key"
  ON "report_snapshot_row"("reportRunId", "rowSequence");
CREATE UNIQUE INDEX "report_artifact_storageKey_key" ON "report_artifact"("storageKey");
CREATE UNIQUE INDEX "report_artifact_reportRunId_format_key"
  ON "report_artifact"("reportRunId", "format");

ALTER TABLE "report_run"
  ADD CONSTRAINT "report_run_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_snapshot_row"
  ADD CONSTRAINT "report_snapshot_row_reportRunId_fkey"
  FOREIGN KEY ("reportRunId") REFERENCES "report_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "report_snapshot_row"
  ADD CONSTRAINT "report_snapshot_row_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_artifact"
  ADD CONSTRAINT "report_artifact_reportRunId_fkey"
  FOREIGN KEY ("reportRunId") REFERENCES "report_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
