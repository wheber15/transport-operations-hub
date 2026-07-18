import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type {
  OrderDetail,
  OrderListItem,
  OrderSearchFilters,
} from "@/features/orders/domain/order";

const orderListSelect = {
  id: true,
  orderNumber: true,
  pickingNumber: true,
  goodsIssueDate: true,
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
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      deliveryNumber: true,
    },
    orderBy: {
      deliveryNumber: "asc",
    },
  },
} satisfies Prisma.OrderSelect;

type OrderListRecord = Prisma.OrderGetPayload<{ select: typeof orderListSelect }>;
type OrderDetailRecord = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;

function toOrderListItem(order: OrderListRecord): OrderListItem {
  const customerIsAvailable = order.customer.deletedAt === null;
  const salesRepIsAvailable = customerIsAvailable && order.customer.salesRep?.deletedAt === null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    pickingNumber: order.pickingNumber,
    goodsIssueDate: order.goodsIssueDate,
    customerName: customerIsAvailable ? order.customer.name : null,
    salesRepName: salesRepIsAvailable ? (order.customer.salesRep?.name ?? null) : null,
  };
}

function toOrderDetail(order: OrderDetailRecord): OrderDetail {
  return {
    ...toOrderListItem(order),
    createdAt: order.createdAt,
    createdByName: order.createdBy?.deletedAt === null ? order.createdBy.displayName : null,
    updatedAt: order.updatedAt,
    updatedByName: order.updatedBy?.deletedAt === null ? order.updatedBy.displayName : null,
    deliveries: order.deliveries,
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
    ],
  };
}

export async function listOrders(filters: OrderSearchFilters) {
  const where = getSearchWhere(filters.query);
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

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: orderDetailSelect,
  });

  return order ? toOrderDetail(order) : null;
}

export async function getOrderByOrderNumber(orderNumber: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      deletedAt: null,
    },
    select: orderDetailSelect,
  });

  return order ? toOrderDetail(order) : null;
}

export async function searchOrders(query: string, page = 1, pageSize = 25) {
  return listOrders({
    query,
    page,
    pageSize,
    sortBy: "orderNumber",
    sortDirection: "asc",
  });
}
