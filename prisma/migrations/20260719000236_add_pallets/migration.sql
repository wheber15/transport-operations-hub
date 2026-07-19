-- CreateTable
CREATE TABLE "pallet" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "actualWeight" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "pallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pallet_deliveryId_deletedAt_idx" ON "pallet"("deliveryId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pallet_deliveryId_sequenceNumber_key" ON "pallet"("deliveryId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "pallet" ADD CONSTRAINT "pallet_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallet" ADD CONSTRAINT "pallet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallet" ADD CONSTRAINT "pallet_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
