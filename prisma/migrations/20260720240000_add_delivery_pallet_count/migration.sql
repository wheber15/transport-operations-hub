ALTER TABLE "delivery"
  ADD COLUMN "actualPalletCount" INTEGER,
  ADD COLUMN "palletCountedAt" TIMESTAMPTZ(3),
  ADD COLUMN "palletCountNote" TEXT,
  ADD COLUMN "palletCountedById" UUID;

CREATE INDEX "delivery_actualPalletCount_idx" ON "delivery"("actualPalletCount");

ALTER TABLE "delivery"
  ADD CONSTRAINT "delivery_palletCountedById_fkey"
  FOREIGN KEY ("palletCountedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
