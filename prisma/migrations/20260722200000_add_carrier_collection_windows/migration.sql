ALTER TABLE "carrier"
  ADD COLUMN "collectionStartTime" TEXT,
  ADD COLUMN "collectionEndTime" TEXT;

UPDATE "carrier"
SET "collectionStartTime" = "collectionTime"
WHERE "collectionTime" IS NOT NULL;
