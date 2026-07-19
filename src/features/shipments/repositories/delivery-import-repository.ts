import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

export type DeliveryImportRecord = {
  deliveryNumber: string;
  deliveryDeletedAt: Date | null;
  orderNumber: string;
  orderDeletedAt: Date | null;
  customerName: string | null;
  shipmentNumber: string | null;
  shipmentDeletedAt: Date | null;
};

const deliveryImportSelect = {
  deliveryNumber: true,
  deletedAt: true,
  shipment: {
    select: {
      shipmentNumber: true,
      deletedAt: true,
    },
  },
  order: {
    select: {
      orderNumber: true,
      deletedAt: true,
      customer: {
        select: {
          name: true,
          deletedAt: true,
        },
      },
    },
  },
} satisfies Prisma.DeliverySelect;

type DeliveryImportPrismaRecord = Prisma.DeliveryGetPayload<{
  select: typeof deliveryImportSelect;
}>;

function toDeliveryImportRecord(record: DeliveryImportPrismaRecord): DeliveryImportRecord {
  return {
    deliveryNumber: record.deliveryNumber,
    deliveryDeletedAt: record.deletedAt,
    orderNumber: record.order.orderNumber,
    orderDeletedAt: record.order.deletedAt,
    customerName: record.order.customer.deletedAt === null ? record.order.customer.name : null,
    shipmentNumber: record.shipment?.shipmentNumber ?? null,
    shipmentDeletedAt: record.shipment?.deletedAt ?? null,
  };
}

export async function findActiveShipment(shipmentId: string) {
  return prisma.shipment.findFirst({
    where: { id: shipmentId, deletedAt: null },
    select: { shipmentNumber: true },
  });
}

export async function findDeliveriesByNumbers(deliveryNumbers: string[]) {
  const deliveries = await prisma.delivery.findMany({
    where: { deliveryNumber: { in: deliveryNumbers } },
    select: deliveryImportSelect,
  });

  return new Map(
    deliveries.map((delivery) => [delivery.deliveryNumber, toDeliveryImportRecord(delivery)])
  );
}

export async function commitEligibleDeliveryImports(input: {
  actorId: string;
  deliveryNumbers: string[];
  shipmentId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const shipment = await transaction.shipment.findFirst({
      where: { id: input.shipmentId, deletedAt: null },
      select: { shipmentNumber: true },
    });

    if (!shipment) return null;

    const beforeRecords = await transaction.delivery.findMany({
      where: { deliveryNumber: { in: input.deliveryNumbers } },
      select: deliveryImportSelect,
    });
    const records = new Map(
      beforeRecords.map((delivery) => [delivery.deliveryNumber, toDeliveryImportRecord(delivery)])
    );
    const assignedDeliveryNumbers = new Set<string>();

    for (const deliveryNumber of input.deliveryNumbers) {
      const record = records.get(deliveryNumber);
      if (!record || record.deliveryDeletedAt || record.orderDeletedAt || record.shipmentNumber)
        continue;

      const update = await transaction.delivery.updateMany({
        where: {
          deliveryNumber,
          deletedAt: null,
          shipmentId: null,
          order: { is: { deletedAt: null } },
        },
        data: { shipmentId: input.shipmentId, updatedById: input.actorId },
      });

      if (update.count !== 1) {
        const refreshed = await transaction.delivery.findFirst({
          where: { deliveryNumber },
          select: deliveryImportSelect,
        });
        if (refreshed) records.set(deliveryNumber, toDeliveryImportRecord(refreshed));
        else records.delete(deliveryNumber);
        continue;
      }

      assignedDeliveryNumbers.add(deliveryNumber);
      records.set(deliveryNumber, {
        ...record,
        shipmentNumber: shipment.shipmentNumber,
        shipmentDeletedAt: null,
      });
      await transaction.activity.create({
        data: {
          entityType: "Shipment",
          entityId: input.shipmentId,
          action: "delivery_imported",
          description: `Delivery ${record.deliveryNumber} assigned to shipment ${shipment.shipmentNumber} by SAP paste import.`,
          actorId: input.actorId,
          createdById: input.actorId,
          updatedById: input.actorId,
        },
      });
    }

    return { assignedDeliveryNumbers, records, shipmentNumber: shipment.shipmentNumber };
  });
}
