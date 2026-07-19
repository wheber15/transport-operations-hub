import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

export type StagedSheet = { name: string; rows: string[][] };

export async function createImportBatch(input: {
  actorId: string;
  importType: string;
  originalFileName: string;
  sheets: StagedSheet[];
}) {
  return prisma.importBatch.create({
    data: {
      importType: input.importType,
      status: "uploaded",
      originalFileName: input.originalFileName,
      uploadedByUserId: input.actorId,
      createdById: input.actorId,
      updatedById: input.actorId,
      totalRows: input.sheets.reduce((count, sheet) => count + sheet.rows.length, 0),
      rows: {
        create: input.sheets.flatMap((sheet) =>
          sheet.rows.map((values, index) => ({
            sheetName: sheet.name,
            sourceRowNumber: index + 1,
            classification: "unsupportedField",
            mappedValues: { values },
            createdById: input.actorId,
            updatedById: input.actorId,
          }))
        ),
      },
    },
  });
}

export async function getImportBatch(id: string) {
  return prisma.importBatch.findFirst({
    where: { id, deletedAt: null },
    include: {
      uploadedBy: { select: { displayName: true } },
      rows: {
        where: { deletedAt: null },
        orderBy: [{ sheetName: "asc" }, { sourceRowNumber: "asc" }],
      },
    },
  });
}

export async function listImportBatches() {
  return prisma.importBatch.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      importType: true,
      status: true,
      originalFileName: true,
      createdAt: true,
      committedAt: true,
      totalRows: true,
      importedRows: true,
      skippedRows: true,
      failedRows: true,
      uploadedBy: { select: { displayName: true } },
    },
  });
}

export async function updateBatchConfiguration(input: {
  id: string;
  actorId: string;
  selectedSheetName?: string | null;
  selectedHeaderRow?: number | null;
  mapping?: Prisma.InputJsonValue | null;
  status: string;
}) {
  return prisma.importBatch.update({
    where: { id: input.id },
    data: {
      selectedSheetName: input.selectedSheetName,
      selectedHeaderRow: input.selectedHeaderRow,
      mapping: input.mapping === null ? Prisma.JsonNull : input.mapping,
      status: input.status,
      previewVersion: { increment: 1 },
      validRows: 0,
      importedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      updatedById: input.actorId,
    },
  });
}

export async function savePreview(input: {
  batchId: string;
  actorId: string;
  rows: {
    id: string;
    identifier: string | null;
    classification: string;
    message: string;
    currentValues: Prisma.InputJsonValue | null;
    proposedValues: Prisma.InputJsonValue | null;
  }[];
}) {
  return prisma.$transaction([
    prisma.importBatch.update({
      where: { id: input.batchId },
      data: {
        status: "previewed",
        validRows: input.rows.filter((row) => row.classification === "validUpdate").length,
        skippedRows: input.rows.filter(
          (row) => row.classification !== "validUpdate" && row.classification !== "unchanged"
        ).length,
        failedRows: input.rows.filter(
          (row) => !["validUpdate", "unchanged"].includes(row.classification)
        ).length,
        updatedById: input.actorId,
      },
    }),
    ...input.rows.map((row) =>
      prisma.importRow.update({
        where: { id: row.id },
        data: {
          identifier: row.identifier,
          classification: row.classification,
          message: row.message,
          currentValues: row.currentValues === null ? Prisma.JsonNull : row.currentValues,
          proposedValues: row.proposedValues === null ? Prisma.JsonNull : row.proposedValues,
          updatedById: input.actorId,
        },
      })
    ),
  ]);
}

export async function getActiveDeliveryRecords(numbers: string[]) {
  return prisma.delivery.findMany({
    where: { deliveryNumber: { in: numbers } },
    select: {
      id: true,
      deliveryNumber: true,
      deletedAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          goodsIssueDate: true,
          shipToNumber: true,
          routeCode: true,
          grossWeightKg: true,
          deletedAt: true,
          customer: { select: { name: true } },
        },
      },
      operationalSchedules: {
        where: { deletedAt: null },
        select: { source: true, scheduledDispatchDate: true, sourceReference: true },
      },
    },
  });
}

export async function commitBatch(batchId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findFirst({
      where: { id: batchId, deletedAt: null },
      include: { rows: { where: { deletedAt: null } } },
    });
    if (!batch || batch.status !== "previewed")
      throw new Error("This import is not ready to commit.");
    let imported = 0;
    let skipped = 0;
    for (const row of batch.rows) {
      if (row.classification !== "validUpdate" || !row.identifier || !row.proposedValues) {
        skipped++;
        continue;
      }
      const proposed = row.proposedValues as Record<string, string>;
      const delivery = await tx.delivery.findFirst({
        where: {
          deliveryNumber: row.identifier,
          deletedAt: null,
          order: { is: { deletedAt: null } },
        },
        include: { order: true },
      });
      if (!delivery) {
        await tx.importRow.update({
          where: { id: row.id },
          data: {
            classification: "unavailableRecord",
            message: "The delivery is unavailable at commit time.",
            updatedById: actorId,
          },
        });
        skipped++;
        continue;
      }
      if (batch.importType === "deliveryReference") {
        const data: Prisma.OrderUncheckedUpdateInput = {};
        if (proposed.goodsIssueDate)
          data.goodsIssueDate = new Date(`${proposed.goodsIssueDate}T00:00:00.000Z`);
        if (proposed.shipToNumber) data.shipToNumber = proposed.shipToNumber;
        if (proposed.routeCode) data.routeCode = proposed.routeCode;
        if (proposed.grossWeightKg) data.grossWeightKg = new Prisma.Decimal(proposed.grossWeightKg);
        if (Object.keys(data).length)
          await tx.order.update({
            where: { id: delivery.orderId },
            data: { ...data, updatedById: actorId },
          });
      } else {
        await tx.operationalSchedule.upsert({
          where: {
            deliveryId_source: { deliveryId: delivery.id, source: proposed.scheduleSource },
          },
          create: {
            deliveryId: delivery.id,
            source: proposed.scheduleSource,
            scheduledDispatchDate: new Date(`${proposed.scheduledDispatchDate}T00:00:00.000Z`),
            sourceReference: proposed.sourceReference || null,
            createdById: actorId,
            updatedById: actorId,
          },
          update: {
            scheduledDispatchDate: new Date(`${proposed.scheduledDispatchDate}T00:00:00.000Z`),
            ...(proposed.sourceReference ? { sourceReference: proposed.sourceReference } : {}),
            updatedById: actorId,
            deletedAt: null,
          },
        });
      }
      imported++;
    }
    const committed = await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: "committed",
        committedAt: new Date(),
        importedRows: imported,
        skippedRows: skipped,
        failedRows: 0,
        updatedById: actorId,
      },
    });
    await tx.activity.create({
      data: {
        entityType: "ImportBatch",
        entityId: batchId,
        action: "data_import_committed",
        description: `${batch.importType} import ${batch.originalFileName}: ${imported} imported, ${skipped} skipped.`,
        actorId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    return committed;
  });
}

export async function purgeExpiredImportPayloads(now: Date) {
  return prisma.importRow.updateMany({
    where: {
      batch: {
        status: { in: ["committed", "failed"] },
        createdAt: { lt: new Date(now.getTime() - 90 * 86400000) },
      },
      deletedAt: null,
    },
    data: {
      mappedValues: Prisma.JsonNull,
      currentValues: Prisma.JsonNull,
      proposedValues: Prisma.JsonNull,
    },
  });
}
export async function deleteAbandonedBatches(now: Date) {
  return prisma.importBatch.deleteMany({
    where: {
      status: { in: ["uploaded", "configured"] },
      createdAt: { lt: new Date(now.getTime() - 7 * 86400000) },
    },
  });
}
