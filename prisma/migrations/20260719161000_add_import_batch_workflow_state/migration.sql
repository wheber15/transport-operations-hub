-- AlterTable
ALTER TABLE "import_batch"
ADD COLUMN "selectedHeaderRow" INTEGER,
ADD COLUMN "mapping" JSONB,
ADD COLUMN "previewVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "import_row"
ADD COLUMN "sheetName" TEXT NOT NULL DEFAULT 'Pending';

-- DropIndex
DROP INDEX "import_row_batchId_sourceRowNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "import_row_batchId_sheetName_sourceRowNumber_key" ON "import_row"("batchId", "sheetName", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "import_row_batchId_sheetName_idx" ON "import_row"("batchId", "sheetName");
