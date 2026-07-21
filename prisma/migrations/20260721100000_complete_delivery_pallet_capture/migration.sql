ALTER TABLE "pallet" ADD COLUMN "note" TEXT;

DROP INDEX "pallet_deliveryId_sequenceNumber_key";

CREATE UNIQUE INDEX "pallet_deliveryId_sequenceNumber_active_key"
  ON "pallet"("deliveryId", "sequenceNumber")
  WHERE "deletedAt" IS NULL;

UPDATE "delivery" AS delivery
SET "actualPalletCount" = counts."palletCount"
FROM (
  SELECT "deliveryId", COUNT(*)::INTEGER AS "palletCount"
  FROM "pallet"
  WHERE "deletedAt" IS NULL
  GROUP BY "deliveryId"
) AS counts
WHERE delivery."id" = counts."deliveryId";

UPDATE "delivery"
SET "actualPalletCount" = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM "pallet"
  WHERE "pallet"."deliveryId" = "delivery"."id"
    AND "pallet"."deletedAt" IS NULL
);
