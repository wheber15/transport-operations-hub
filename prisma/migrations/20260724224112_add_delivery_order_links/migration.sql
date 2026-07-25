-- CreateEnum
CREATE TYPE "DeliveryOrderLinkSource" AS ENUM ('BACKFILL', 'SAP_IMPORT', 'MANUAL');

-- CreateTable
CREATE TABLE "delivery_order_link" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "source" "DeliveryOrderLinkSource" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "delivery_order_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_order_link_deliveryId_idx" ON "delivery_order_link"("deliveryId");

-- CreateIndex
CREATE INDEX "delivery_order_link_orderId_idx" ON "delivery_order_link"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_order_link_deliveryId_orderId_key" ON "delivery_order_link"("deliveryId", "orderId");

-- Backfill the legacy primary Order relationship as one immutable association per Delivery.
-- The deterministic UUID and unique constraint make this safe to replay without duplicate links.
INSERT INTO "delivery_order_link" ("id", "deliveryId", "orderId", "source", "createdAt", "createdById")
SELECT
    md5(d."id"::text || ':' || d."orderId"::text)::uuid,
    d."id",
    d."orderId",
    'BACKFILL'::"DeliveryOrderLinkSource",
    d."createdAt",
    d."createdById"
FROM "delivery" d
ON CONFLICT ("deliveryId", "orderId") DO NOTHING;

-- AddForeignKey
ALTER TABLE "delivery_order_link" ADD CONSTRAINT "delivery_order_link_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_order_link" ADD CONSTRAINT "delivery_order_link_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_order_link" ADD CONSTRAINT "delivery_order_link_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
