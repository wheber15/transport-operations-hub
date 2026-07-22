import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type {
  AvailableDeliveryList,
  ShipmentDelivery,
  ShipmentDetail,
  ShipmentListItem,
  ShipmentSearchFilters,
  ShipmentsSummary,
} from "@/features/shipments/types/shipment";
import {
  calculatePalletWeightSummary,
  estimatePalletCount,
} from "@/features/orders/domain/pallets";
import { getShipmentMovementState, type MovementTimes } from "@/features/shipments/domain/movement";

const shipmentListSelect = {
  id: true,
  carrierId: true,
  shipmentNumber: true,
  dispatchDate: true,
  deliveryDate: true,
  status: true,
  driverInAt: true,
  trailerLoadedAt: true,
  driverOutAt: true,
  carrier: {
    select: {
      name: true,
      carrierNumber: true,
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
    carrierNumber: shipment.carrier.deletedAt === null ? shipment.carrier.carrierNumber : null,
    dispatchDate: shipment.dispatchDate,
    deliveryDate: shipment.deliveryDate,
    actualPallets: palletSummary.palletCount === 0 ? null : palletSummary.palletCount,
    actualWeight: palletSummary.actualPalletWeightKg,
    deliveryCount: shipment._count.deliveries,
    status: shipment.status,
    movementState: getShipmentMovementState(shipment),
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
    driverInAt: shipment.driverInAt,
    trailerLoadedAt: shipment.trailerLoadedAt,
    driverOutAt: shipment.driverOutAt,
    activities: [],
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

export function buildShipmentsWhere(filters: ShipmentSearchFilters): Prisma.ShipmentWhereInput {
  const query = filters.query?.trim();
  return {
    deletedAt: null,
    ...(query
      ? {
          OR: [
            { shipmentNumber: { contains: query, mode: "insensitive" } },
            { carrier: { name: { contains: query, mode: "insensitive" } } },
            { carrier: { carrierNumber: { contains: query, mode: "insensitive" } } },
            {
              deliveries: {
                some: { deletedAt: null, deliveryNumber: { contains: query, mode: "insensitive" } },
              },
            },
            {
              deliveries: {
                some: {
                  deletedAt: null,
                  order: {
                    is: { deletedAt: null, orderNumber: { contains: query, mode: "insensitive" } },
                  },
                },
              },
            },
          ],
        }
      : {}),
    AND: [
      ...(filters.carrierId ? [{ carrierId: filters.carrierId }] : []),
      ...(filters.status === "all"
        ? []
        : [{ status: filters.status.toUpperCase() as "OPEN" | "CLOSED" }]),
      ...(filters.deliveryNumber
        ? [
            {
              deliveries: {
                some: {
                  deletedAt: null,
                  deliveryNumber: { contains: filters.deliveryNumber, mode: "insensitive" },
                },
              },
            },
          ]
        : []),
      ...(filters.orderNumber
        ? [
            {
              deliveries: {
                some: {
                  deletedAt: null,
                  order: {
                    is: {
                      deletedAt: null,
                      orderNumber: { contains: filters.orderNumber, mode: "insensitive" },
                    },
                  },
                },
              },
            },
          ]
        : []),
    ] as Prisma.ShipmentWhereInput[],
    ...(filters.dispatchFrom || filters.dispatchTo
      ? {
          dispatchDate: {
            ...(filters.dispatchFrom
              ? { gte: new Date(`${filters.dispatchFrom}T00:00:00.000Z`) }
              : {}),
            ...(filters.dispatchTo ? { lte: new Date(`${filters.dispatchTo}T00:00:00.000Z`) } : {}),
          },
        }
      : {}),
  };
}

export async function list(filters: ShipmentSearchFilters) {
  const where = buildShipmentsWhere(filters);
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

export async function getSummary(filters: ShipmentSearchFilters): Promise<ShipmentsSummary> {
  const where = buildShipmentsWhere(filters);
  const [shipments, total, openShipments] = await Promise.all([
    prisma.shipment.findMany({ where, select: shipmentListSelect }),
    prisma.shipment.count({ where }),
    prisma.shipment.count({ where: { AND: [where, { status: "OPEN" }] } }),
  ]);
  const items = shipments.map(toShipmentListItem);
  const actualWeight = items.reduce(
    (totalWeight, item) => totalWeight + Number(item.actualWeight ?? 0),
    0
  );
  return {
    shipments: total,
    plannedPallets: items.reduce((totalPallets, item) => totalPallets + item.estimatedPallets, 0),
    actualPallets: items.reduce(
      (totalPallets, item) => totalPallets + (item.actualPallets ?? 0),
      0
    ),
    actualWeight: actualWeight === 0 ? null : actualWeight.toFixed(3),
    openShipments,
  };
}

export async function getById(id: string): Promise<ShipmentDetail | null> {
  const [shipment, activities] = await Promise.all([
    prisma.shipment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: shipmentDetailSelect,
    }),
    prisma.activity.findMany({
      where: { entityType: "Shipment", entityId: id, deletedAt: null },
      select: {
        action: true,
        description: true,
        metadata: true,
        occurredAt: true,
        actor: { select: { displayName: true, deletedAt: true } },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    }),
  ]);

  if (!shipment) return null;
  return {
    ...toShipmentDetail(shipment),
    activities: activities.map((activity) => ({
      action: activity.action,
      description: activity.description,
      metadata: activity.metadata,
      occurredAt: activity.occurredAt,
      actorName: activity.actor.deletedAt === null ? activity.actor.displayName : null,
    })),
  };
}

export async function search(query: string, page = 1, pageSize = 25) {
  return list({
    query,
    page,
    pageSize,
    datePreset: "all",
    status: "all",
    sortBy: "shipmentNumber",
    sortDirection: "asc",
  });
}

export async function listActiveCarriers() {
  return prisma.carrier.findMany({
    where: { deletedAt: null, active: true },
    select: {
      id: true,
      name: true,
      carrierNumber: true,
      collectionStartTime: true,
      collectionEndTime: true,
      dailyTrailerLimit: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function listCarriersForShipmentFilters() {
  return prisma.carrier.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, carrierNumber: true, active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }, { id: "asc" }],
  });
}

export async function isActiveCarrier(carrierId: string) {
  return Boolean(
    await prisma.carrier.findFirst({
      where: { id: carrierId, deletedAt: null, active: true },
      select: { id: true },
    })
  );
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
      where: { id: input.shipmentId, deletedAt: null },
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
      where: { id: shipmentId, deletedAt: null },
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

export async function updateMovementTimesAtomically(input: {
  actorId: string;
  shipmentId: string;
  times: MovementTimes;
}) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: input.shipmentId, deletedAt: null },
      select: {
        shipmentNumber: true,
        status: true,
        driverInAt: true,
        trailerLoadedAt: true,
        driverOutAt: true,
      },
    });
    if (!shipment) return "not-found" as const;

    const previous: MovementTimes = {
      driverInAt: shipment.driverInAt,
      trailerLoadedAt: shipment.trailerLoadedAt,
      driverOutAt: shipment.driverOutAt,
    };
    const trailerJustLoaded =
      previous.trailerLoadedAt === null && input.times.trailerLoadedAt !== null;
    const action = determineMovementAction(previous, input.times);
    const now = new Date();
    await tx.shipment.update({
      where: { id: input.shipmentId },
      data: {
        ...input.times,
        ...(trailerJustLoaded && shipment.status === "OPEN"
          ? { status: "CLOSED", closedAt: now, closedById: input.actorId }
          : {}),
        updatedById: input.actorId,
      },
    });
    await tx.activity.create({
      data: {
        entityType: "Shipment",
        entityId: input.shipmentId,
        action,
        description: movementActivityDescription(action, shipment.shipmentNumber),
        metadata: {
          previous: serialiseMovementTimes(previous),
          current: serialiseMovementTimes(input.times),
          statusClosedAutomatically: trailerJustLoaded && shipment.status === "OPEN",
        },
        actorId: input.actorId,
        createdById: input.actorId,
        updatedById: input.actorId,
      },
    });
    return "updated" as const;
  });
}

function serialiseMovementTimes(times: MovementTimes) {
  return Object.fromEntries(
    Object.entries(times).map(([key, value]) => [key, value?.toISOString() ?? null])
  );
}

function sameTime(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime();
}

function determineMovementAction(previous: MovementTimes, current: MovementTimes) {
  if (
    !previous.driverInAt &&
    current.driverInAt &&
    sameTime(previous.trailerLoadedAt, current.trailerLoadedAt) &&
    sameTime(previous.driverOutAt, current.driverOutAt)
  )
    return "driver_in_recorded";
  if (
    !previous.trailerLoadedAt &&
    current.trailerLoadedAt &&
    sameTime(previous.driverInAt, current.driverInAt) &&
    sameTime(previous.driverOutAt, current.driverOutAt)
  )
    return "trailer_loaded";
  if (
    !previous.driverOutAt &&
    current.driverOutAt &&
    sameTime(previous.driverInAt, current.driverInAt) &&
    sameTime(previous.trailerLoadedAt, current.trailerLoadedAt)
  )
    return "driver_out_recorded";
  return "movement_times_corrected";
}

function movementActivityDescription(action: string, shipmentNumber: string) {
  const descriptions: Record<string, string> = {
    driver_in_recorded: `Driver In recorded for shipment ${shipmentNumber}.`,
    trailer_loaded: `Trailer Loaded recorded for shipment ${shipmentNumber}; shipment closed.`,
    driver_out_recorded: `Driver Out recorded for shipment ${shipmentNumber}.`,
    movement_times_corrected: `Movement times corrected for shipment ${shipmentNumber}.`,
  };
  return descriptions[action] ?? `Movement updated for shipment ${shipmentNumber}.`;
}

export async function deleteShipment(actorId: string, shipmentId: string) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
      select: { shipmentNumber: true },
    });
    if (!shipment) return "not-found" as const;
    const released = await tx.delivery.updateMany({
      where: { shipmentId, deletedAt: null },
      data: { shipmentId: null, updatedById: actorId },
    });
    const deletedAt = new Date();
    await tx.shipment.update({
      where: { id: shipmentId },
      data: { deletedAt, updatedById: actorId },
    });
    await tx.activity.create({
      data: {
        entityType: "Shipment",
        entityId: shipmentId,
        action: "shipment_deleted",
        description: `Shipment ${shipment.shipmentNumber} deleted; ${released.count} deliveries released to Awaiting Shipment.`,
        metadata: { releasedDeliveryCount: released.count, deletedAt: deletedAt.toISOString() },
        actorId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    return { releasedDeliveryCount: released.count };
  });
}
