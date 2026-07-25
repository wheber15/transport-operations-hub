UPDATE "order"
SET "sapGoodsIssueDate" = "goodsIssueDate"
WHERE "sapGoodsIssueDate" IS NULL
  AND "goodsIssueDate" IS NOT NULL;

CREATE INDEX "import_batch_dateMismatchAcknowledgedById_idx"
ON "import_batch"("dateMismatchAcknowledgedById");
