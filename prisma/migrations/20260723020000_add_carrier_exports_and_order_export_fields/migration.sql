CREATE TYPE "CarrierExportStage" AS ENUM ('INITIAL', 'UPDATE', 'ADDITION');
CREATE TYPE "CarrierExportStatus" AS ENUM ('PENDING', 'GENERATED', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "CarrierExportArtifactFormat" AS ENUM ('XLSX');
CREATE TYPE "CarrierExportArtifactStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');
CREATE TYPE "CarrierExportChangeClassification" AS ENUM ('ADDED', 'CHANGED', 'UNCHANGED', 'REMOVED');

ALTER TABLE "order"
  ADD COLUMN "purchaseOrderNumber" VARCHAR(200),
  ADD COLUMN "shipToCity" VARCHAR(120),
  ADD COLUMN "shipToName2" VARCHAR(200),
  ADD COLUMN "shipToPostalCode" VARCHAR(40),
  ADD COLUMN "shipToRegion" VARCHAR(40),
  ADD COLUMN "shipToStreet" VARCHAR(200);

CREATE TABLE "carrier_export_sequence" (
  "id" UUID NOT NULL,
  "carrierId" UUID NOT NULL,
  "goodsIssueDate" DATE NOT NULL,
  "stage" "CarrierExportStage" NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "carrier_export_sequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "carrier_export_run" (
  "id" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "carrierId" UUID NOT NULL,
  "goodsIssueDate" DATE NOT NULL,
  "stage" "CarrierExportStage" NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "CarrierExportStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMPTZ(3),
  "sentById" UUID,
  "baselineRunId" UUID,
  "filename" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "distinctDeliveryCount" INTEGER NOT NULL DEFAULT 0,
  "totalWeightKg" DECIMAL(14,3),
  "totalPallets" INTEGER NOT NULL DEFAULT 0,
  "addedCount" INTEGER NOT NULL DEFAULT 0,
  "changedCount" INTEGER NOT NULL DEFAULT 0,
  "removedCount" INTEGER NOT NULL DEFAULT 0,
  "unchangedCount" INTEGER NOT NULL DEFAULT 0,
  "datasetChecksum" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "generatedById" UUID,
  "generatedByDisplayName" TEXT NOT NULL,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "generatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "carrier_export_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "carrier_export_row" (
  "id" UUID NOT NULL,
  "exportRunId" UUID NOT NULL,
  "rowSequence" INTEGER NOT NULL,
  "deliveryId" UUID NOT NULL,
  "deliveryNumber" TEXT NOT NULL,
  "normalizedPayload" JSONB NOT NULL,
  "rowChecksum" TEXT NOT NULL,
  "changeClassification" "CarrierExportChangeClassification" NOT NULL,
  "baselineRowChecksum" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "carrier_export_row_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "carrier_export_artifact" (
  "id" UUID NOT NULL,
  "exportRunId" UUID NOT NULL,
  "format" "CarrierExportArtifactFormat" NOT NULL DEFAULT 'XLSX',
  "status" "CarrierExportArtifactStatus" NOT NULL DEFAULT 'PENDING',
  "storageKey" TEXT,
  "filename" TEXT,
  "contentType" TEXT,
  "byteSize" BIGINT,
  "checksumSha256" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "generatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "carrier_export_artifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carrier_export_sequence_carrierId_goodsIssueDate_stage_key"
  ON "carrier_export_sequence"("carrierId", "goodsIssueDate", "stage");
CREATE UNIQUE INDEX "carrier_export_run_reference_key" ON "carrier_export_run"("reference");
CREATE INDEX "carrier_export_run_carrierId_goodsIssueDate_status_idx"
  ON "carrier_export_run"("carrierId", "goodsIssueDate", "status");
CREATE UNIQUE INDEX "carrier_export_run_carrierId_goodsIssueDate_stage_sequence_key"
  ON "carrier_export_run"("carrierId", "goodsIssueDate", "stage", "sequence");
CREATE UNIQUE INDEX "carrier_export_row_exportRunId_rowSequence_key"
  ON "carrier_export_row"("exportRunId", "rowSequence");
CREATE UNIQUE INDEX "carrier_export_row_exportRunId_deliveryNumber_key"
  ON "carrier_export_row"("exportRunId", "deliveryNumber");
CREATE UNIQUE INDEX "carrier_export_artifact_storageKey_key"
  ON "carrier_export_artifact"("storageKey");
CREATE UNIQUE INDEX "carrier_export_artifact_exportRunId_format_key"
  ON "carrier_export_artifact"("exportRunId", "format");

ALTER TABLE "carrier_export_sequence"
  ADD CONSTRAINT "carrier_export_sequence_carrierId_fkey"
  FOREIGN KEY ("carrierId") REFERENCES "carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carrier_export_run"
  ADD CONSTRAINT "carrier_export_run_carrierId_fkey"
  FOREIGN KEY ("carrierId") REFERENCES "carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "carrier_export_run_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "carrier_export_run_sentById_fkey"
  FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "carrier_export_run_baselineRunId_fkey"
  FOREIGN KEY ("baselineRunId") REFERENCES "carrier_export_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carrier_export_row"
  ADD CONSTRAINT "carrier_export_row_exportRunId_fkey"
  FOREIGN KEY ("exportRunId") REFERENCES "carrier_export_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "carrier_export_row_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carrier_export_artifact"
  ADD CONSTRAINT "carrier_export_artifact_exportRunId_fkey"
  FOREIGN KEY ("exportRunId") REFERENCES "carrier_export_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
