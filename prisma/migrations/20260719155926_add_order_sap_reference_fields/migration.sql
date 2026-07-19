-- AlterTable
ALTER TABLE "order" ADD COLUMN     "grossWeightKg" DECIMAL(12,3),
ADD COLUMN     "routeCode" TEXT,
ADD COLUMN     "shipToNumber" TEXT;

-- CreateIndex
CREATE INDEX "order_shipToNumber_idx" ON "order"("shipToNumber");

-- CreateIndex
CREATE INDEX "order_routeCode_idx" ON "order"("routeCode");
