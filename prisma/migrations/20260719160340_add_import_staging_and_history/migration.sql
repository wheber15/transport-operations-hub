-- CreateTable
CREATE TABLE "import_batch" (
    "id" UUID NOT NULL,
    "importType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "selectedSheetName" TEXT,
    "uploadedByUserId" UUID NOT NULL,
    "committedAt" TIMESTAMPTZ(3),
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_row" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "identifier" TEXT,
    "classification" TEXT NOT NULL,
    "message" TEXT,
    "mappedValues" JSONB,
    "currentValues" JSONB,
    "proposedValues" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "import_row_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batch_uploadedByUserId_idx" ON "import_batch"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "import_batch_status_idx" ON "import_batch"("status");

-- CreateIndex
CREATE INDEX "import_batch_createdAt_idx" ON "import_batch"("createdAt");

-- CreateIndex
CREATE INDEX "import_row_batchId_classification_idx" ON "import_row"("batchId", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "import_row_batchId_sourceRowNumber_key" ON "import_row"("batchId", "sourceRowNumber");

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
