import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type {
  DashboardActivity,
  DashboardCustomerAttention,
  DashboardData,
  DashboardOrder,
  DashboardShipment,
} from "@/features/dashboard/types/dashboard";
import type { getOperationalDateOnlyRange } from "@/server/config/operational-timezone";

const dashboardListLimit = 5;

const orderSelect = {
  orderNumber: true,
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

const shipmentSelect = {
  id: true,
  shipmentNumber: true,
  dispatchDate: true,
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

const activitySelect = {
  action: true,
  description: true,
  occurredAt: true,
  actor: {
    select: {
      displayName: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.ActivitySelect;

const customerAttentionSelect = {
  name: true,
  salesRep: {
    select: {
      name: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.CustomerSelect;

type OrderRecord = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;
type ShipmentRecord = Prisma.ShipmentGetPayload<{ select: typeof shipmentSelect }>;
type ActivityRecord = Prisma.ActivityGetPayload<{ select: typeof activitySelect }>;
type CustomerAttentionRecord = Prisma.CustomerGetPayload<{
  select: typeof customerAttentionSelect;
}>;

function toDashboardOrder(order: OrderRecord): DashboardOrder {
  const customerIsAvailable = order.customer.deletedAt === null;
  const salesRepIsAvailable = customerIsAvailable && order.customer.salesRep?.deletedAt === null;

  return {
    orderNumber: order.orderNumber,
    customerName: customerIsAvailable ? order.customer.name : null,
    salesRepName: salesRepIsAvailable ? (order.customer.salesRep?.name ?? null) : null,
    goodsIssueDate: order.goodsIssueDate,
  };
}

function toDashboardShipment(shipment: ShipmentRecord): DashboardShipment {
  return {
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    carrierName: shipment.carrier.deletedAt === null ? shipment.carrier.name : null,
    dispatchDate: shipment.dispatchDate,
    deliveryCount: shipment._count.deliveries,
  };
}

function toDashboardActivity(activity: ActivityRecord): DashboardActivity {
  return {
    action: activity.action,
    description: activity.description,
    actorName: activity.actor.deletedAt === null ? activity.actor.displayName : null,
    occurredAt: activity.occurredAt,
  };
}

function toDashboardCustomerAttention(
  customer: CustomerAttentionRecord
): DashboardCustomerAttention {
  return {
    customerName: customer.name,
    salesRepName: customer.salesRep?.deletedAt === null ? customer.salesRep.name : null,
  };
}

export async function getDashboardData(
  operationalDateRange: Pick<ReturnType<typeof getOperationalDateOnlyRange>, "end" | "start">
): Promise<DashboardData> {
  const [
    todaysOrders,
    recentShipments,
    recentActivity,
    customersRequiringAttention,
    orders,
    customers,
    shipments,
    carriers,
    salesReps,
  ] = await prisma.$transaction([
    prisma.order.findMany({
      where: {
        deletedAt: null,
        goodsIssueDate: {
          gte: operationalDateRange.start,
          lt: operationalDateRange.end,
        },
      },
      select: orderSelect,
      orderBy: [{ goodsIssueDate: "asc" }, { orderNumber: "asc" }, { id: "asc" }],
      take: dashboardListLimit,
    }),
    prisma.shipment.findMany({
      where: { deletedAt: null },
      select: shipmentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: dashboardListLimit,
    }),
    prisma.activity.findMany({
      where: { deletedAt: null },
      select: activitySelect,
      orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
      take: dashboardListLimit,
    }),
    prisma.customer.findMany({
      where: {
        deletedAt: null,
        repIssues: {
          some: {
            deletedAt: null,
          },
        },
      },
      select: customerAttentionSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: dashboardListLimit,
    }),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.shipment.count({ where: { deletedAt: null } }),
    prisma.carrier.count({ where: { deletedAt: null } }),
    prisma.salesRep.count({ where: { deletedAt: null } }),
  ]);

  return {
    todaysOrders: todaysOrders.map(toDashboardOrder),
    recentShipments: recentShipments.map(toDashboardShipment),
    recentActivity: recentActivity.map(toDashboardActivity),
    customersRequiringAttention: customersRequiringAttention.map(toDashboardCustomerAttention),
    summary: {
      orders,
      customers,
      shipments,
      carriers,
      salesReps,
    },
  };
}
