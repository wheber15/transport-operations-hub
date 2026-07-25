-- AlterTable
ALTER TABLE "import_batch" ADD COLUMN     "dateMismatchAcknowledgedAt" TIMESTAMPTZ(3),
ADD COLUMN     "dateMismatchAcknowledgedById" UUID,
ADD COLUMN     "dateMismatchReason" VARCHAR(500),
ADD COLUMN     "intendedGoodsIssueDate" DATE;

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "sapGoodsIssueDate" DATE;

-- CreateIndex
CREATE INDEX "order_sapGoodsIssueDate_idx" ON "order"("sapGoodsIssueDate");

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_dateMismatchAcknowledgedById_fkey" FOREIGN KEY ("dateMismatchAcknowledgedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
