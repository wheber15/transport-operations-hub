-- CreateTable
CREATE TABLE "operational_schedule" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "scheduledDispatchDate" DATE NOT NULL,
    "sourceReference" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "operational_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_schedule_scheduledDispatchDate_idx" ON "operational_schedule"("scheduledDispatchDate");

-- CreateIndex
CREATE INDEX "operational_schedule_source_idx" ON "operational_schedule"("source");

-- CreateIndex
CREATE UNIQUE INDEX "operational_schedule_deliveryId_source_key" ON "operational_schedule"("deliveryId", "source");

-- AddForeignKey
ALTER TABLE "operational_schedule" ADD CONSTRAINT "operational_schedule_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_schedule" ADD CONSTRAINT "operational_schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_schedule" ADD CONSTRAINT "operational_schedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
