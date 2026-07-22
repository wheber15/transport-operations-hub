ALTER TABLE "carrier"
    ADD COLUMN "carrierNumber" TEXT,
    ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "contactName" TEXT,
    ADD COLUMN "email" TEXT,
    ADD COLUMN "phone" TEXT,
    ADD COLUMN "collectionTime" TEXT,
    ADD COLUMN "dailyTrailerLimit" INTEGER,
    ADD COLUMN "notes" TEXT;

UPDATE "carrier" SET "carrierNumber" = 'LEGACY-' || "id" WHERE "carrierNumber" IS NULL;

ALTER TABLE "carrier" ALTER COLUMN "carrierNumber" SET NOT NULL;
CREATE UNIQUE INDEX "carrier_carrierNumber_key" ON "carrier"("carrierNumber");
CREATE INDEX "carrier_active_name_idx" ON "carrier"("active", "name");
