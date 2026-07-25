import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

export type StagedSheet = { name: string; rows: (string | null)[][] };
export type SapOrderBookStagedRow = {
  sourceRowNumber: number;
  identifier: string;
  classification: string;
  message: string;
  currentValues: Prisma.InputJsonValue | null;
  proposedValues: Prisma.InputJsonValue;
};

function logDevelopmentCheckpoint(
  checkpoint: string,
  details?: {
    sourceRowNumber?: number;
    deliveryNumber?: string | null;
    orderNumber?: string | null;
  }
) {
  if (process.env.NODE_ENV === "development") console.info(`[data-import] ${checkpoint}`, details);
}

export async function createSapOrderBookBatch(input: {
  actorId: string;
  originalFileName: string;
  sheetName: string;
  headerRowNumber: number;
  rows: SapOrderBookStagedRow[];
}) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        importType: "sapOrderBook",
        status: "configured",
        originalFileName: input.originalFileName,
        selectedSheetName: input.sheetName,
        selectedHeaderRow: input.headerRowNumber,
        mapping: {
          deliveryNumber: "Sales Document",
          orderNumber: "Originating Document",
          customerName: "Name 1",
          shipToNumber: "Ship-To Party",
          routeCode: "Route",
          goodsIssueDate: "Goods Issue Date",
          grossWeightKg: "Open gross weight",
          shippingPoint: "Shipping Point/Receiving Pt",
        },
        uploadedByUserId: input.actorId,
        createdById: input.actorId,
        updatedById: input.actorId,
        totalRows: input.rows.length,
        validRows: 0,
        skippedRows: 0,
        failedRows: 0,
      },
    });
    if (input.rows.length) {
      await tx.importRow.createMany({
        data: input.rows.map((row) => ({
          batchId: batch.id,
          sheetName: input.sheetName,
          sourceRowNumber: row.sourceRowNumber,
          identifier: row.identifier,
          classification: row.classification,
          message: row.message,
          mappedValues: row.proposedValues,
          currentValues: row.currentValues ?? Prisma.JsonNull,
          proposedValues: row.proposedValues,
          createdById: input.actorId,
          updatedById: input.actorId,
        })),
      });
    }
    return batch;
  });
}

export async function createImportBatch(input: {
  actorId: string;
  importType: string;
  originalFileName: string;
  sheets: StagedSheet[];
}) {
  const rows = input.sheets.flatMap((sheet) =>
    sheet.rows.flatMap((values, index) =>
      values.some((value) => value !== null && value !== "")
        ? [{ sheetName: sheet.name, sourceRowNumber: index + 1, values }]
        : []
    )
  );
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        importType: input.importType,
        status: "uploaded",
        originalFileName: input.originalFileName,
        uploadedByUserId: input.actorId,
        createdById: input.actorId,
        updatedById: input.actorId,
        totalRows: rows.length,
      },
    });
    for (let index = 0; index < rows.length; index += 250) {
      await tx.importRow.createMany({
        data: rows.slice(index, index + 250).map((row) => ({
          batchId: batch.id,
          sheetName: row.sheetName,
          sourceRowNumber: row.sourceRowNumber,
          classification: "unsupportedField",
          mappedValues: { values: row.values } as Prisma.InputJsonValue,
          createdById: input.actorId,
          updatedById: input.actorId,
        })),
      });
    }
    return batch;
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

export async function getImportBatchPreviewContext(id: string) {
  return prisma.importBatch.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      importType: true,
      status: true,
      selectedSheetName: true,
      selectedHeaderRow: true,
      mapping: true,
      totalRows: true,
      validRows: true,
      importedRows: true,
      skippedRows: true,
      failedRows: true,
    },
  });
}

export async function getImportHeaderRow(batchId: string, sheetName: string, headerRow: number) {
  return prisma.importRow.findFirst({
    where: {
      batchId,
      sheetName,
      sourceRowNumber: headerRow,
      deletedAt: null,
    },
    select: { mappedValues: true },
  });
}

export async function getPreviewRows(input: {
  batchId: string;
  sheetName: string;
  headerRow: number;
  page: number;
  pageSize: number;
  classification?: string;
  query?: string;
}) {
  const where: Prisma.ImportRowWhereInput = {
    batchId: input.batchId,
    sheetName: input.sheetName,
    sourceRowNumber: { gt: input.headerRow },
    deletedAt: null,
    ...(input.classification ? { classification: input.classification } : {}),
    ...(input.query
      ? {
          OR: [
            { identifier: { contains: input.query, mode: "insensitive" } },
            { proposedValues: { path: ["customerName"], string_contains: input.query } },
            { currentValues: { path: ["customerName"], string_contains: input.query } },
          ],
        }
      : {}),
  };
  const [rows, total, classifications] = await prisma.$transaction([
    prisma.importRow.findMany({
      where,
      orderBy: { sourceRowNumber: "asc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        sourceRowNumber: true,
        identifier: true,
        classification: true,
        message: true,
        mappedValues: true,
        currentValues: true,
        proposedValues: true,
      },
    }),
    prisma.importRow.count({ where }),
    prisma.importRow.groupBy({
      by: ["classification"],
      orderBy: { classification: "asc" },
      where: {
        batchId: input.batchId,
        sheetName: input.sheetName,
        sourceRowNumber: { gt: input.headerRow },
        deletedAt: null,
      },
      _count: { _all: true },
    }),
  ]);
  return { rows, total, classifications };
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

export async function saveSapOrderBookDatePreview(input: {
  batchId: string;
  actorId: string;
  intendedGoodsIssueDate: Date;
  acknowledgement: { at: Date; byId: string; reason: string } | null;
  rows: Parameters<typeof savePreview>[0]["rows"];
}) {
  return prisma.$transaction([
    prisma.importBatch.update({
      where: { id: input.batchId },
      data: {
        status: "previewed",
        intendedGoodsIssueDate: input.intendedGoodsIssueDate,
        dateMismatchAcknowledgedAt: input.acknowledgement?.at ?? null,
        dateMismatchAcknowledgedById: input.acknowledgement?.byId ?? null,
        dateMismatchReason: input.acknowledgement?.reason ?? null,
        validRows: input.rows.filter((row) =>
          ["readyToCreate", "readyToUpdate", "unchanged", "readyToCreateWithDateOverride", "readyToUpdateWithDateOverride", "unchangedWithDateOverride"].includes(row.classification)
        ).length,
        skippedRows: input.rows.filter((row) =>
          !["readyToCreate", "readyToUpdate", "unchanged", "readyToCreateWithDateOverride", "readyToUpdateWithDateOverride", "unchangedWithDateOverride"].includes(row.classification)
        ).length,
        failedRows: input.rows.filter((row) =>
          !["readyToCreate", "readyToUpdate", "unchanged", "readyToCreateWithDateOverride", "readyToUpdateWithDateOverride", "unchangedWithDateOverride"].includes(row.classification)
        ).length,
        updatedById: input.actorId,
      },
    }),
    ...input.rows.map((row) =>
      prisma.importRow.update({
        where: { id: row.id },
        data: {
          classification: row.classification,
          message: row.message,
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
      shipmentId: true,
      deletedAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          goodsIssueDate: true,
          shipToNumber: true,
          routeCode: true,
          shippingPoint: true,
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

export async function getOrderRecords(numbers: string[]) {
  return prisma.order.findMany({
    where: { orderNumber: { in: numbers } },
    select: {
      id: true,
      orderNumber: true,
      goodsIssueDate: true,
      shipToNumber: true,
      routeCode: true,
      shippingPoint: true,
      grossWeightKg: true,
      deletedAt: true,
      customer: { select: { name: true } },
    },
  });
}

export async function commitBatch(batchId: string, actorId: string) {
  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.findFirst({
        where: { id: batchId, deletedAt: null },
        include: { rows: { where: { deletedAt: null } } },
      });
      logDevelopmentCheckpoint("commit batch loaded");
      if (!batch) throw new Error("Import batch was not found.");
      if (batch.status === "committed") throw new Error("BATCH_ALREADY_COMMITTED");
      if (batch.status !== "previewed") throw new Error("This import is not ready to commit.");
      logDevelopmentCheckpoint("commit batch status validated");
      let imported = 0;
      let skipped = 0;
      logDevelopmentCheckpoint("commit transaction started");
      for (const row of batch.rows) {
        const sapActionable = ["readyToCreate", "readyToUpdate", "readyToCreateWithDateOverride", "readyToUpdateWithDateOverride", "alreadyAssignedToShipment", "validUpdate"].includes(
          row.classification
        );
        if (
          (batch.importType === "sapOrderBook" ? !sapActionable : row.classification !== "validUpdate") ||
          !row.identifier ||
          !row.proposedValues
        ) {
          skipped++;
          continue;
        }
        const proposed = row.proposedValues as Record<string, string>;
        if (batch.importType === "sapOrderBook") {
          const proposed = row.proposedValues as Record<string, string | null>;
          const orderNumber = proposed.orderNumber;
          if (!orderNumber) {
            skipped++;
            continue;
          }
          if (!proposed.goodsIssueDate) {
            await tx.importRow.update({
              where: { id: row.id },
              data: {
                classification: "missingSapDate",
                message: "SAP Goods Issue Date is missing or invalid at commit time.",
                updatedById: actorId,
              },
            });
            skipped++;
            continue;
          }
          const sourceDate = proposed.goodsIssueDate;
          const intendedDate = batch.intendedGoodsIssueDate?.toISOString().slice(0, 10) ?? null;
          if (
            intendedDate &&
            sourceDate !== intendedDate &&
            (!batch.dateMismatchAcknowledgedAt || !batch.dateMismatchReason)
          ) {
            await tx.importRow.update({
              where: { id: row.id },
              data: {
                classification: "dateMismatchRequiresAcknowledgement",
                message: "Date mismatch acknowledgement is required before committing.",
                updatedById: actorId,
              },
            });
            skipped++;
            continue;
          }
          const rowDetails = {
            sourceRowNumber: row.sourceRowNumber,
            deliveryNumber: row.identifier,
            orderNumber,
          };
          logDevelopmentCheckpoint("SAP delivery lookup started", rowDetails);
          const existingDelivery = await tx.delivery.findFirst({
            where: { deliveryNumber: row.identifier },
            select: { id: true, orderId: true, deletedAt: true },
          });
          logDevelopmentCheckpoint("SAP delivery lookup completed", rowDetails);
          if (existingDelivery?.deletedAt) {
            await tx.importRow.update({
              where: { id: row.id },
              data: {
                classification: "unavailableRecord",
                message: "The Delivery is unavailable at commit time.",
                updatedById: actorId,
              },
            });
            skipped++;
            continue;
          }
          const existingOrder = await tx.order.findFirst({
            where: { orderNumber },
            select: { id: true, deletedAt: true },
          });
          if (existingOrder?.deletedAt) {
            await tx.importRow.update({
              where: { id: row.id },
              data: {
                classification: "unavailableRecord",
                message: "The Originating Order is unavailable at commit time.",
                updatedById: actorId,
              },
            });
            skipped++;
            continue;
          }
          let customerId: string | null = null;
          if (!existingOrder) {
            if (!proposed.customerName) {
              skipped++;
              continue;
            }
            const customer = await tx.customer.findFirst({
              where: { name: proposed.customerName, deletedAt: null },
              select: { id: true },
            });
            customerId = customer
              ? customer.id
              : (
                  await tx.customer.create({
                    data: {
                      name: proposed.customerName,
                      createdById: actorId,
                      updatedById: actorId,
                    },
                    select: { id: true },
                  })
                ).id;
          }
          const orderData: {
            goodsIssueDate?: Date;
            sapGoodsIssueDate?: Date;
            grossWeightKg?: Prisma.Decimal;
            routeCode?: string;
            shipToNumber?: string;
            shippingPoint?: string;
          } = {};
          if (proposed.goodsIssueDate) {
            const sapGoodsIssueDate = new Date(`${proposed.goodsIssueDate}T00:00:00.000Z`);
            orderData.sapGoodsIssueDate = sapGoodsIssueDate;
            orderData.goodsIssueDate =
              batch.intendedGoodsIssueDate ?? sapGoodsIssueDate;
          }
          if (proposed.shipToNumber) orderData.shipToNumber = proposed.shipToNumber;
          if (proposed.routeCode) orderData.routeCode = proposed.routeCode;
          if (proposed.shippingPoint) orderData.shippingPoint = proposed.shippingPoint;
          if (proposed.grossWeightKg && proposed.grossWeightKg !== "0.000")
            orderData.grossWeightKg = new Prisma.Decimal(proposed.grossWeightKg);
          const order = existingOrder
            ? ({
                id: existingOrder.id,
              })
            : await tx.order.create({
                data: {
                  orderNumber,
                  customerId: customerId!,
                  ...orderData,
                  createdById: actorId,
                  updatedById: actorId,
                },
                select: { id: true },
              });
          if (existingOrder)
            await tx.order.update({
              where: { id: existingOrder.id },
              data: { ...orderData, updatedById: actorId },
            });
          const delivery = existingDelivery
            ? existingDelivery
            : await tx.delivery.create({
                data: {
                  deliveryNumber: row.identifier,
                  orderId: order.id,
                  createdById: actorId,
                  updatedById: actorId,
                },
                select: { id: true, orderId: true, deletedAt: true },
              });
          await tx.deliveryOrderLink.upsert({
            where: { deliveryId_orderId: { deliveryId: delivery.id, orderId: order.id } },
            create: {
              deliveryId: delivery.id,
              orderId: order.id,
              source: "SAP_IMPORT",
              createdById: actorId,
            },
            update: {},
          });
          imported++;
          continue;
        }
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
          if (proposed.grossWeightKg)
            data.grossWeightKg = new Prisma.Decimal(proposed.grossWeightKg);
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
      logDevelopmentCheckpoint("commit batch status update started");
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
      if (process.env.NODE_ENV === "development")
        console.info(
          `[data-import] commit rows completed: imported=${imported}, skipped=${skipped}`
        );
      logDevelopmentCheckpoint("commit batch status updated");
      logDevelopmentCheckpoint("commit Activity creation started");
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
      logDevelopmentCheckpoint("commit Activity creation completed");
      logDevelopmentCheckpoint("commit transaction completed");
      return committed;
    },
    { maxWait: 10_000, timeout: 60_000 }
  );
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
