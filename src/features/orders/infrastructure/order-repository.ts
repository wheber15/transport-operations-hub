import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type {
  OrderDetail,
  OrderListItem,
  OrderSearchFilters,
  OrdersSummary,
} from "@/features/orders/domain/order";
import {
  calculatePalletWeightSummary,
  estimatePalletCount,
} from "@/features/orders/domain/pallets";
import { areOrderExportFieldsAvailable } from "@/features/orders/lib/order-export-field-gate";
import type { OrderAdminUpdateInput } from "@/features/orders/validation/order-schemas";

const orderListSelect = {
  id: true,
  orderNumber: true,
  pickingNumber: true,
  goodsIssueDate: true,
  shipToNumber: true,
  routeCode: true,
  shippingPoint: true,
  grossWeightKg: true,
  deletedAt: true,
  updatedBy: { select: { displayName: true, deletedAt: true } },
  customer: {
    select: {
      name: true,
      deletedAt: true,
      salesRep: {
        select: {
          name: true,
          deletedAt: true,
        },
      },
    },
  },
  deliveries: {
    where: { deletedAt: null },
    orderBy: { deliveryNumber: "asc" },
    take: 1,
    select: {
      id: true,
      deliveryNumber: true,
      shipment: { select: { shipmentNumber: true } },
      pallets: { where: { deletedAt: null }, select: { actualWeight: true } },
    },
  },
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  ...orderListSelect,
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
  deliveries: {
    where: { deletedAt: null },
    select: {
      id: true,
      deliveryNumber: true,
      shipment: { select: { shipmentNumber: true } },
      pallets: { where: { deletedAt: null }, select: { actualWeight: true } },
      orderLinks: {
        select: {
          orderId: true,
          order: {
            select: {
              orderNumber: true,
              purchaseOrderNumber: true,
              grossWeightKg: true,
              goodsIssueDate: true,
              shipToNumber: true,
              deletedAt: true,
            },
          },
        },
        orderBy: { order: { orderNumber: "asc" } },
      },
    },
    orderBy: { deliveryNumber: "asc" },
  },
} satisfies Prisma.OrderSelect;

type OrderListRecord = Prisma.OrderGetPayload<{ select: typeof orderListSelect }>;
type OrderDetailRecord = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;

function toOrderListItem(order: OrderListRecord): OrderListItem {
  const customerIsAvailable = order.customer.deletedAt === null;
  const salesRepIsAvailable = customerIsAvailable && order.customer.salesRep?.deletedAt === null;

  const delivery = order.deliveries[0];
  const sapGrossWeightKg = order.grossWeightKg?.toFixed(3) ?? null;
  const palletSummary = calculatePalletWeightSummary(
    delivery?.pallets.map((pallet) => pallet.actualWeight.toFixed(3)) ?? [],
    sapGrossWeightKg
  );
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    pickingNumber: order.pickingNumber,
    goodsIssueDate: order.goodsIssueDate,
    customerName: customerIsAvailable ? order.customer.name : null,
    salesRepName: salesRepIsAvailable ? (order.customer.salesRep?.name ?? null) : null,
    shipToNumber: order.shipToNumber,
    routeCode: order.routeCode,
    shippingPoint: order.shippingPoint,
    grossWeightKg: sapGrossWeightKg,
    estimatedPalletCount: estimatePalletCount(sapGrossWeightKg),
    deliveryId: delivery?.id ?? null,
    deliveryNumber: delivery?.deliveryNumber ?? null,
    shipmentNumber: delivery?.shipment?.shipmentNumber ?? null,
    actualPalletCount: delivery && palletSummary.palletCount > 0 ? palletSummary.palletCount : null,
    actualPalletWeightKg: palletSummary.actualPalletWeightKg,
    weightVarianceKg: palletSummary.varianceKg,
    palletStatus: palletSummary.status,
    palletWeightStatus: palletSummary.weightStatus,
    deletedAt: order.deletedAt,
    deletedByName:
      order.deletedAt && order.updatedBy?.deletedAt === null ? order.updatedBy.displayName : null,
  };
}

function toOrderDetail(order: OrderDetailRecord, purchaseOrderNumber: string | null): OrderDetail {
  return {
    ...toOrderListItem(order),
    purchaseOrderNumber,
    createdAt: order.createdAt,
    createdByName: order.createdBy?.deletedAt === null ? order.createdBy.displayName : null,
    updatedAt: order.updatedAt,
    updatedByName: order.updatedBy?.deletedAt === null ? order.updatedBy.displayName : null,
    deliveries: order.deliveries.map((delivery) => {
      const summary = calculatePalletWeightSummary(
        delivery.pallets.map((pallet) => pallet.actualWeight.toFixed(3)),
        order.grossWeightKg?.toFixed(3) ?? null
      );
      return {
        id: delivery.id,
        deliveryNumber: delivery.deliveryNumber,
        actualPalletCount: summary.palletCount > 0 ? summary.palletCount : null,
        actualPalletWeightKg: summary.actualPalletWeightKg,
        weightVarianceKg: summary.varianceKg,
        palletStatus: summary.status,
        palletWeightStatus: summary.weightStatus,
        shipmentNumber: delivery.shipment?.shipmentNumber ?? null,
        linkedOrders: delivery.orderLinks.map((link) => ({
          orderNumber: link.order.orderNumber,
          isPrimary: link.orderId === order.id,
          purchaseOrderNumber: link.order.purchaseOrderNumber,
          grossWeightKg: link.order.grossWeightKg?.toFixed(3) ?? null,
          goodsIssueDate: link.order.goodsIssueDate,
          shipToNumber: link.order.shipToNumber,
          deletedAt: link.order.deletedAt,
        })),
      };
    }),
  };
}

function getOrderBy(
  sortBy: OrderSearchFilters["sortBy"],
  sortDirection: OrderSearchFilters["sortDirection"]
) {
  const orderBy: Record<OrderSearchFilters["sortBy"], Prisma.OrderOrderByWithRelationInput> = {
    orderNumber: { orderNumber: sortDirection },
    customer: { customer: { name: sortDirection } },
    pickingNumber: { pickingNumber: { sort: sortDirection, nulls: "last" } },
    goodsIssueDate: { goodsIssueDate: { sort: sortDirection, nulls: "last" } },
  };

  return [orderBy[sortBy], { id: "asc" }] satisfies Prisma.OrderOrderByWithRelationInput[];
}

function getSearchWhere(query: string | undefined): Prisma.OrderWhereInput {
  if (!query) {
    return { deletedAt: null };
  }

  return {
    deletedAt: null,
    OR: [
      { orderNumber: { contains: query, mode: "insensitive" } },
      { pickingNumber: { contains: query, mode: "insensitive" } },
      { customer: { name: { contains: query, mode: "insensitive" } } },
      { shipToNumber: { contains: query, mode: "insensitive" } },
      { routeCode: { contains: query, mode: "insensitive" } },
      {
        deliveries: {
          some: { deliveryNumber: { contains: query, mode: "insensitive" }, deletedAt: null },
        },
      },
      {
        deliveries: {
          some: {
            shipment: {
              is: { shipmentNumber: { contains: query, mode: "insensitive" }, deletedAt: null },
            },
            deletedAt: null,
          },
        },
      },
    ],
  };
}

export function buildOrdersWhere(filters: OrderSearchFilters): Prisma.OrderWhereInput {
  const where = getSearchWhere(filters.query);
  const base: Prisma.OrderWhereInput = {
    ...where,
    AND: [
      ...(filters.shipmentState === "assigned"
        ? [{ deliveries: { some: { deletedAt: null, shipmentId: { not: null } } } }]
        : []),
      ...(filters.shipmentState === "unassigned"
        ? [{ deliveries: { some: { deletedAt: null, shipmentId: null } } }]
        : []),
      ...(filters.palletState === "awaiting"
        ? [{ deliveries: { some: { deletedAt: null, pallets: { none: { deletedAt: null } } } } }]
        : []),
      ...(filters.palletState === "captured"
        ? [{ deliveries: { some: { deletedAt: null, pallets: { some: { deletedAt: null } } } } }]
        : []),
    ],
    ...(filters.recordState === "active"
      ? { deletedAt: null }
      : filters.recordState === "deleted"
        ? { deletedAt: { not: null } }
        : {}),
    ...(filters.customer
      ? { customer: { name: { contains: filters.customer, mode: "insensitive" } } }
      : {}),
    ...(filters.route ? { routeCode: { equals: filters.route, mode: "insensitive" } } : {}),
    ...(filters.shipTo ? { shipToNumber: { equals: filters.shipTo, mode: "insensitive" } } : {}),
  };
  if (!filters.goodsIssueFrom && !filters.goodsIssueTo) return base;
  return {
    ...base,
    goodsIssueDate: {
      ...(filters.goodsIssueFrom
        ? { gte: new Date(`${filters.goodsIssueFrom}T00:00:00.000Z`) }
        : {}),
      ...(filters.goodsIssueTo ? { lte: new Date(`${filters.goodsIssueTo}T00:00:00.000Z`) } : {}),
    },
  };
}

export async function listOrders(filters: OrderSearchFilters) {
  const where = buildOrdersWhere(filters);
  const skip = (filters.page - 1) * filters.pageSize;

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: orderListSelect,
      orderBy: getOrderBy(filters.sortBy, filters.sortDirection),
      skip,
      take: filters.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { items: items.map(toOrderListItem), total };
}

export async function getOrdersSummary(filters: OrderSearchFilters): Promise<OrdersSummary> {
  const where = buildOrdersWhere(filters);
  const orderRelation = { is: where };
  const [orders, deliveries, assignedToShipment, awaitingActualPalletData] = await Promise.all([
    prisma.order.count({ where }),
    prisma.delivery.count({ where: { deletedAt: null, order: orderRelation } }),
    prisma.order.count({
      where: {
        AND: [where, { deliveries: { some: { deletedAt: null, shipmentId: { not: null } } } }],
      },
    }),
    prisma.order.count({
      where: {
        AND: [
          where,
          { deliveries: { some: { deletedAt: null, pallets: { none: { deletedAt: null } } } } },
        ],
      },
    }),
  ]);
  return { orders, deliveries, assignedToShipment, awaitingActualPalletData };
}

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: orderDetailSelect,
  });

  if (!order) return null;

  const exportFields = areOrderExportFieldsAvailable()
    ? await prisma.order.findFirst({
        where: { id, deletedAt: null },
        select: { purchaseOrderNumber: true },
      })
    : null;

  return toOrderDetail(order, exportFields?.purchaseOrderNumber ?? null);
}

export async function getOrderByOrderNumber(orderNumber: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      deletedAt: null,
    },
    select: orderDetailSelect,
  });

  if (!order) return null;

  const exportFields = areOrderExportFieldsAvailable()
    ? await prisma.order.findFirst({
        where: { orderNumber, deletedAt: null },
        select: { purchaseOrderNumber: true },
      })
    : null;

  return toOrderDetail(order, exportFields?.purchaseOrderNumber ?? null);
}

function toBusinessDate(value: string | null | undefined) {
  return value === undefined
    ? undefined
    : value === null
      ? null
      : new Date(`${value}T00:00:00.000Z`);
}

function toManualOrderData(input: OrderAdminUpdateInput, actorId: string) {
  return {
    ...(input.pickingNumber !== undefined ? { pickingNumber: input.pickingNumber } : {}),
    ...(input.goodsIssueDate !== undefined
      ? { goodsIssueDate: toBusinessDate(input.goodsIssueDate) }
      : {}),
    ...(input.shipToNumber !== undefined ? { shipToNumber: input.shipToNumber } : {}),
    ...(input.routeCode !== undefined ? { routeCode: input.routeCode } : {}),
    ...(input.shippingPoint !== undefined ? { shippingPoint: input.shippingPoint } : {}),
    ...(input.grossWeightKg !== undefined ? { grossWeightKg: input.grossWeightKg } : {}),
    ...(input.purchaseOrderNumber !== undefined
      ? { purchaseOrderNumber: input.purchaseOrderNumber }
      : {}),
    updatedById: actorId,
  };
}

export async function updateActiveOrder(actorId: string, id: string, input: OrderAdminUpdateInput) {
  const updated = await prisma.order.updateMany({
    where: { id, deletedAt: null },
    data: toManualOrderData(input, actorId),
  });
  if (updated.count === 0) return null;
  await prisma.activity.create({
    data: {
      entityType: "Order",
      entityId: id,
      action: "order_updated",
      description: "Order operational details updated.",
      actorId,
      createdById: actorId,
      updatedById: actorId,
    },
  });
  return getOrderById(id);
}

async function changeOrderRecordState(actorId: string, id: string, deletedAt: Date | null) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: deletedAt ? { id, deletedAt: null } : { id, deletedAt: { not: null } },
      data: { deletedAt, updatedById: actorId },
    });
    if (updated.count === 0) return null;
    await tx.activity.create({
      data: {
        entityType: "Order",
        entityId: id,
        action: deletedAt ? "order_soft_deleted" : "order_restored",
        description: deletedAt ? "Order soft-deleted." : "Order restored.",
        actorId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    return true;
  });
}

export function softDeleteOrder(actorId: string, id: string) {
  return changeOrderRecordState(actorId, id, new Date());
}

export function restoreOrder(actorId: string, id: string) {
  return changeOrderRecordState(actorId, id, null);
}

export async function searchOrders(query: string, page = 1, pageSize = 25) {
  return listOrders({
    query,
    page,
    pageSize,
    sortBy: "orderNumber",
    sortDirection: "asc",
    datePreset: "all",
  });
}
