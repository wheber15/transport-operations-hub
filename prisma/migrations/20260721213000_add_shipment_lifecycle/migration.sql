CREATE TYPE "ShipmentStatus" AS ENUM ('OPEN', 'CLOSED');

ALTER TABLE "shipment"
  ADD COLUMN "status" "ShipmentStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "closedAt" TIMESTAMPTZ(3),
  ADD COLUMN "closedById" UUID;

CREATE INDEX "shipment_status_idx" ON "shipment"("status");
CREATE INDEX "shipment_closedById_idx" ON "shipment"("closedById");

ALTER TABLE "shipment"
  ADD CONSTRAINT "shipment_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
