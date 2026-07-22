import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type {
  AvailableDeliveryList,
  ShipmentDelivery,
  ShipmentDetail,
  ShipmentListItem,
  ShipmentSearchFilters,
} from "@/features/shipments/types/shipment";
import {
  calculatePalletWeightSummary,
  estimatePalletCount,
} from "@/features/orders/domain/pallets";

const shipmentListSelect = {
  id: true,
  carrierId: true,
  shipmentNumber: true,
  dispatchDate: true,
  deliveryDate: true,
  status: true,
  carrier: {
    select: {
      name: true,
      deletedAt: true,
    },
  },
  _count: {
    select: {
      deliveries: {
        where: {
          deletedAt: null,
          order: {
            is: {
              deletedAt: null,
            },
          },
        },
      },
    },
  },
  deliveries: {
    where: { deletedAt: null, order: { is: { deletedAt: null } } },
    select: {
      order: { select: { id: true, grossWeightKg: true } },
      pallets: { where: { deletedAt: null }, select: { actualWeight: true } },
    },
  },
} satisfies Prisma.ShipmentSelect;

const shipmentDetailSelect = {
  ...shipmentListSelect,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      displayName: true,
      deletedAt: true,
    },
  },
  updatedBy: {
    select: {
      displayName: true,
      deletedAt: true,
    },
  },
  closedAt: true,
  closedBy: { select: { displayName: true, deletedAt: true } },
} satisfies Prisma.ShipmentSelect;

const deliverySelect = {
  id: true,
  deliveryNumber: true,
  order: {
    select: {
      orderNumber: true,
    },
  },
} satisfies Prisma.DeliverySelect;

type ShipmentListRecord = Prisma.ShipmentGetPayload<{ select: typeof shipmentListSelect }>;
type ShipmentDetailRecord = Prisma.ShipmentGetPayload<{ select: typeof shipmentDetailSelect }>;
type DeliveryRecord = Prisma.DeliveryGetPayload<{ select: typeof deliverySelect }>;

function toShipmentListItem(shipment: ShipmentListRecord): ShipmentListItem {
  const palletSummary = calculatePalletWeightSummary(
    shipment.deliveries.flatMap((delivery) =>
      delivery.pallets.map((pallet) => pallet.actualWeight.toFixed(3))
    ),
    null
  );
  return {
    id: shipment.id,
    carrierId: shipment.carrierId,
    shipmentNumber: shipment.shipmentNumber,
    carrierName: shipment.carrier.deletedAt === null ? shipment.carrier.name : null,
    dispatchDate: shipment.dispatchDate,
    deliveryDate: shipment.deliveryDate,
    actualPallets: palletSummary.palletCount === 0 ? null : palletSummary.palletCount,
    actualWeight: palletSummary.actualPalletWeightKg,
    deliveryCount: shipment._count.deliveries,
    status: shipment.status,
    orderCount: new Set(shipment.deliveries.map((delivery) => delivery.order.id)).size,
    estimatedPallets: shipment.deliveries.reduce(
      (total, delivery) =>
        total + (estimatePalletCount(delivery.order.grossWeightKg?.toFixed(3) ?? null) ?? 0),
      0
    ),
  };
}

function toShipmentDetail(shipment: ShipmentDetailRecord): ShipmentDetail {
  const orderWeights = shipment.deliveries
    .map((delivery) => delivery.order.grossWeightKg?.toFixed(3) ?? null)
    .filter((weight): weight is string => weight !== null);
  const orderNumbers = new Set(shipment.deliveries.map((delivery) => delivery.order.id));
  const sapGrossWeight = orderWeights
    .reduce((total, weight) => total + Number(weight), 0)
    .toFixed(3);
  return {
    ...toShipmentListItem(shipment),
    notes: shipment.notes,
    createdAt: shipment.createdAt,
    createdByName: shipment.createdBy?.deletedAt === null ? shipment.createdBy.displayName : null,
    updatedAt: shipment.updatedAt,
    updatedByName: shipment.updatedBy?.deletedAt === null ? shipment.updatedBy.displayName : null,
    closedAt: shipment.closedAt,
    closedByName: shipment.closedBy?.deletedAt === null ? shipment.closedBy.displayName : null,
    orderCount: orderNumbers.size,
    estimatedPallets: [...new Set(shipment.deliveries.map((delivery) => delivery.order.id))].reduce(
      (total, orderId) =>
        total +
        (estimatePalletCount(
          shipment.deliveries
            .find((delivery) => delivery.order.id === orderId)
            ?.order.grossWeightKg?.toFixed(3) ?? null
        ) ?? 0),
      0
    ),
    sapGrossWeight: orderWeights.length > 0 ? sapGrossWeight : null,
  };
}

function toShipmentDelivery(delivery: DeliveryRecord): ShipmentDelivery {
  return {
    id: delivery.id,
    deliveryNumber: delivery.deliveryNumber,
    orderNumber: delivery.order.orderNumber,
  };
}

function getOrderBy(
  sortBy: ShipmentSearchFilters["sortBy"],
  sortDirection: ShipmentSearchFilters["sortDirection"]
) {
  const orderBy: Record<ShipmentSearchFilters["sortBy"], Prisma.ShipmentOrderByWithRelationInput> =
    {
      shipmentNumber: { shipmentNumber: sortDirection },
      carrier: { carrier: { name: sortDirection } },
      dispatchDate: { dispatchDate: { sort: sortDirection, nulls: "last" } },
      deliveryDate: { deliveryDate: { sort: sortDirection, nulls: "last" } },
      actualPallets: { actualPallets: { sort: sortDirection, nulls: "last" } },
      actualWeight: { actualWeight: { sort: sortDirection, nulls: "last" } },
      deliveryCount: { deliveries: { _count: sortDirection } },
    };

  return [orderBy[sortBy], { id: "asc" }] satisfies Prisma.ShipmentOrderByWithRelationInput[];
}

function getSearchWhere(query: string | undefined): Prisma.ShipmentWhereInput {
  if (!query) {
    return { deletedAt: null };
  }

  return {
    deletedAt: null,
    OR: [
      { shipmentNumber: { contains: query, mode: "insensitive" } },
      { carrier: { name: { contains: query, mode: "insensitive" } } },
    ],
  };
}

export async function list(filters: ShipmentSearchFilters) {
  const where = getSearchWhere(filters.query);
  const skip = (filters.page - 1) * filters.pageSize;

  const [items, total] = await prisma.$transaction([
    prisma.shipment.findMany({
      where,
      select: shipmentListSelect,
      orderBy: [{ status: "asc" }, ...getOrderBy(filters.sortBy, filters.sortDirection)],
      skip,
      take: filters.pageSize,
    }),
    prisma.shipment.count({ where }),
  ]);

  return { items: items.map(toShipmentListItem), total };
}

export async function getById(id: string): Promise<ShipmentDetail | null> {
  const shipment = await prisma.shipment.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: shipmentDetailSelect,
  });

  return shipment ? toShipmentDetail(shipment) : null;
}

export async function search(query: string, page = 1, pageSize = 25) {
  return list({
    query,
    page,
    pageSize,
    sortBy: "shipmentNumber",
    sortDirection: "asc",
  });
}

export async function listActiveCarriers() {
  return prisma.carrier.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      carrierNumber: true,
      collectionTime: true,
      dailyTrailerLimit: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function listDeliveries(shipmentId: string): Promise<ShipmentDelivery[]> {
  const deliveries = await prisma.delivery.findMany({
    where: {
      shipmentId,
      deletedAt: null,
      order: {
        is: {
          deletedAt: null,
        },
      },
    },
    select: deliverySelect,
    orderBy: [{ deliveryNumber: "asc" }, { id: "asc" }],
  });

  return deliveries.map(toShipmentDelivery);
}

export async function listAvailableDeliveries(limit = 100): Promise<AvailableDeliveryList> {
  const deliveries = await prisma.delivery.findMany({
    where: {
      shipmentId: null,
      deletedAt: null,
      order: {
        is: {
          deletedAt: null,
        },
      },
    },
    select: deliverySelect,
    orderBy: [{ deliveryNumber: "asc" }, { id: "asc" }],
    take: limit + 1,
  });
  const hasMore = deliveries.length > limit;

  return {
    items: deliveries.slice(0, limit).map(toShipmentDelivery),
    hasMore,
  };
}

export async function assignDeliveryAtomically(input: {
  actorId: string;
  deliveryId: string;
  shipmentId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const shipment = await transaction.shipment.findFirst({
      where: { id: input.shipmentId, deletedAt: null, status: "OPEN" },
      select: { shipmentNumber: true },
    });
    if (!shipment) return "shipment-not-found" as const;

    const delivery = await transaction.delivery.findFirst({
      where: { id: input.deliveryId, deletedAt: null, order: { is: { deletedAt: null } } },
      select: { deliveryNumber: true },
    });
    if (!delivery) return "delivery-not-found" as const;

    const result = await transaction.delivery.updateMany({
      where: {
        id: input.deliveryId,
        deletedAt: null,
        shipmentId: null,
        order: { is: { deletedAt: null } },
      },
      data: { shipmentId: input.shipmentId, updatedById: input.actorId },
    });
    if (result.count !== 1) return "conflict" as const;

    await transaction.activity.create({
      data: {
        entityType: "Shipment",
        entityId: input.shipmentId,
        action: "delivery_assigned",
        description: `Delivery ${delivery.deliveryNumber} assigned to shipment ${shipment.shipmentNumber}.`,
        actorId: input.actorId,
        createdById: input.actorId,
        updatedById: input.actorId,
      },
    });
    return "assigned" as const;
  });
}

export async function unassignDeliveryAtomically(input: {
  actorId: string;
  deliveryId: string;
  shipmentId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const shipment = await transaction.shipment.findFirst({
      where: { id: input.shipmentId, deletedAt: null, status: "OPEN" },
      select: { shipmentNumber: true },
    });
    if (!shipment) return "shipment-not-found" as const;

    const delivery = await transaction.delivery.findFirst({
      where: { id: input.deliveryId, deletedAt: null, order: { is: { deletedAt: null } } },
      select: { deliveryNumber: true },
    });
    if (!delivery) return "delivery-not-found" as const;

    const result = await transaction.delivery.updateMany({
      where: {
        id: input.deliveryId,
        deletedAt: null,
        shipmentId: input.shipmentId,
        order: { is: { deletedAt: null } },
      },
      data: { shipmentId: null, updatedById: input.actorId },
    });
    if (result.count !== 1) return "conflict" as const;

    await transaction.activity.create({
      data: {
        entityType: "Shipment",
        entityId: input.shipmentId,
        action: "delivery_unassigned",
        description: `Delivery ${delivery.deliveryNumber} removed from shipment ${shipment.shipmentNumber}.`,
        actorId: input.actorId,
        createdById: input.actorId,
        updatedById: input.actorId,
      },
    });
    return "unassigned" as const;
  });
}

export async function createShipment(
  actorId: string,
  input: {
    shipmentNumber: string;
    carrierId: string;
    dispatchDate?: string | null;
    deliveryDate?: string | null;
    notes?: string | null;
  }
) {
  try {
    return await prisma.shipment.create({
      data: {
        shipmentNumber: input.shipmentNumber,
        carrierId: input.carrierId,
        dispatchDate: input.dispatchDate ? new Date(`${input.dispatchDate}T00:00:00.000Z`) : null,
        deliveryDate: input.deliveryDate ? new Date(`${input.deliveryDate}T00:00:00.000Z`) : null,
        notes: input.notes ?? null,
        createdById: actorId,
        updatedById: actorId,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
      return "duplicate" as const;
    throw error;
  }
}

export async function updateOpenShipment(
  actorId: string,
  shipmentId: string,
  input: {
    shipmentNumber?: string;
    carrierId?: string;
    dispatchDate?: string | null;
    deliveryDate?: string | null;
    notes?: string | null;
  }
) {
  try {
    const result = await prisma.shipment.updateMany({
      where: { id: shipmentId, deletedAt: null, status: "OPEN" },
      data: {
        ...(input.shipmentNumber === undefined ? {} : { shipmentNumber: input.shipmentNumber }),
        ...(input.carrierId === undefined ? {} : { carrierId: input.carrierId }),
        ...(input.dispatchDate === undefined
          ? {}
          : {
              dispatchDate: input.dispatchDate
                ? new Date(`${input.dispatchDate}T00:00:00.000Z`)
                : null,
            }),
        ...(input.deliveryDate === undefined
          ? {}
          : {
              deliveryDate: input.deliveryDate
                ? new Date(`${input.deliveryDate}T00:00:00.000Z`)
                : null,
            }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        updatedById: actorId,
      },
    });
    return result.count === 1 ? "updated" : ("not-open" as const);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
      return "duplicate" as const;
    throw error;
  }
}

export async function closeShipment(actorId: string, shipmentId: string, confirmEmpty: boolean) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null, status: "OPEN" },
      select: {
        shipmentNumber: true,
        _count: {
          select: {
            deliveries: { where: { deletedAt: null, order: { is: { deletedAt: null } } } },
          },
        },
      },
    });
    if (!shipment) return "not-open" as const;
    if (shipment._count.deliveries === 0 && !confirmEmpty) return "empty" as const;
    await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: "CLOSED", closedAt: new Date(), closedById: actorId, updatedById: actorId },
    });
    await tx.activity.create({
      data: {
        entityType: "Shipment",
        entityId: shipmentId,
        action: "shipment_closed",
        description: `Shipment ${shipment.shipmentNumber} closed.`,
        actorId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    return "closed" as const;
  });
}
