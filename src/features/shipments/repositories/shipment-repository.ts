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

const shipmentListSelect = {
  id: true,
  shipmentNumber: true,
  dispatchDate: true,
  deliveryDate: true,
  actualPallets: true,
  actualWeight: true,
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
  return {
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    carrierName: shipment.carrier.deletedAt === null ? shipment.carrier.name : null,
    dispatchDate: shipment.dispatchDate,
    deliveryDate: shipment.deliveryDate,
    actualPallets: shipment.actualPallets,
    actualWeight: shipment.actualWeight?.toString() ?? null,
    deliveryCount: shipment._count.deliveries,
  };
}

function toShipmentDetail(shipment: ShipmentDetailRecord): ShipmentDetail {
  return {
    ...toShipmentListItem(shipment),
    notes: shipment.notes,
    createdAt: shipment.createdAt,
    createdByName: shipment.createdBy?.deletedAt === null ? shipment.createdBy.displayName : null,
    updatedAt: shipment.updatedAt,
    updatedByName: shipment.updatedBy?.deletedAt === null ? shipment.updatedBy.displayName : null,
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
      orderBy: getOrderBy(filters.sortBy, filters.sortDirection),
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
