import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  calculatePalletWeightSummary,
  estimatePalletCount,
} from "@/features/orders/domain/pallets";
import type {
  DashboardData,
  DashboardOrder,
  DashboardRemainingOrder,
} from "@/features/dashboard/types/dashboard";
type BusinessDateRange = { end: Date; start: Date };

const dashboardListLimit = 8;
const todayWhere = (range: BusinessDateRange) =>
  ({
    deletedAt: null,
    goodsIssueDate: { gte: range.start, lt: range.end },
  }) satisfies Prisma.OrderWhereInput;

const todayOrderSelect = {
  id: true,
  orderNumber: true,
  shipToNumber: true,
  routeCode: true,
  grossWeightKg: true,
  customer: { select: { name: true, deletedAt: true } },
  deliveries: {
    where: { deletedAt: null },
    orderBy: { deliveryNumber: "asc" },
    take: 1,
    select: {
      shipment: { select: { shipmentNumber: true } },
      pallets: { where: { deletedAt: null }, select: { actualWeight: true } },
    },
  },
} satisfies Prisma.OrderSelect;

type TodayOrderRecord = Prisma.OrderGetPayload<{ select: typeof todayOrderSelect }>;

function toDashboardOrder(order: TodayOrderRecord): DashboardOrder {
  const delivery = order.deliveries[0];
  const grossWeightKg = order.grossWeightKg?.toFixed(3) ?? null;
  const pallet = calculatePalletWeightSummary(
    delivery?.pallets.map((item) => item.actualWeight.toFixed(3)) ?? [],
    grossWeightKg
  );
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customer.deletedAt === null ? order.customer.name : null,
    shipToNumber: order.shipToNumber,
    routeCode: order.routeCode,
    grossWeightKg,
    estimatedPalletCount: estimatePalletCount(grossWeightKg),
    actualPalletCount: pallet.palletCount || null,
    shipmentNumber: delivery?.shipment?.shipmentNumber ?? null,
    status: pallet.status === "captured" ? "captured" : "awaiting",
    weightStatus: pallet.weightStatus,
  };
}

export function getRemainingTodayOrder(order: DashboardOrder): DashboardRemainingOrder | null {
  const reasons: DashboardRemainingOrder["reason"][] = [];
  if (order.status === "awaiting") reasons.push("Awaiting pallet data");
  if (!order.shipmentNumber) reasons.push("Not assigned");
  if (order.weightStatus === "over") reasons.push("Over SAP weight");
  if (order.weightStatus === "under") reasons.push("Under SAP weight");
  if (!order.routeCode || !order.shipToNumber || !order.grossWeightKg)
    reasons.push("Missing planning data");
  if (!reasons.length) return null;
  const priority = [
    "Awaiting pallet data",
    "Not assigned",
    "Over SAP weight",
    "Under SAP weight",
    "Missing planning data",
  ] as const;
  const reason = priority.find((candidate) => reasons.includes(candidate))!;
  return { ...order, reason, additionalIssueCount: reasons.length - 1 };
}

export async function getDashboardData(range: BusinessDateRange): Promise<DashboardData> {
  const where = todayWhere(range);
  const [todayRecords, total, assigned, awaitingPalletData, unassigned, recentShipments] =
    await Promise.all([
      prisma.order.findMany({
        where,
        select: todayOrderSelect,
        orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
      }),
      prisma.order.count({ where }),
      prisma.order.count({
        where: {
          AND: [where, { deliveries: { some: { deletedAt: null, shipmentId: { not: null } } } }],
        },
      }),
      prisma.order.count({
        where: {
          AND: [
            where,
            {
              OR: [
                { deliveries: { none: { deletedAt: null } } },
                {
                  deliveries: { some: { deletedAt: null, pallets: { none: { deletedAt: null } } } },
                },
              ],
            },
          ],
        },
      }),
      prisma.order.count({
        where: {
          AND: [
            where,
            {
              OR: [
                { deliveries: { none: { deletedAt: null } } },
                { deliveries: { some: { deletedAt: null, shipmentId: null } } },
              ],
            },
          ],
        },
      }),
      prisma.shipment.findMany({
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 5,
        select: {
          id: true,
          shipmentNumber: true,
          dispatchDate: true,
          carrier: { select: { name: true, deletedAt: true } },
          deliveries: {
            where: { deletedAt: null, order: { is: { deletedAt: null } } },
            select: { pallets: { where: { deletedAt: null }, select: { id: true } } },
          },
        },
      }),
    ]);
  const orders = todayRecords.map(toDashboardOrder);
  const remainingOrders = orders
    .map(getRemainingTodayOrder)
    .filter((order): order is DashboardRemainingOrder => order !== null);
  const weightCounts = {
    exactWeight: orders.filter((order) => order.weightStatus === "exact").length,
    underWeight: orders.filter((order) => order.weightStatus === "under").length,
    overWeight: orders.filter((order) => order.weightStatus === "over").length,
  };
  return {
    todayOrders: orders.slice(0, dashboardListLimit),
    remainingToday: remainingOrders
      .sort(
        (left, right) =>
          left.reason.localeCompare(right.reason) ||
          left.orderNumber.localeCompare(right.orderNumber)
      )
      .slice(0, dashboardListLimit),
    recentShipments: recentShipments.map((shipment) => ({
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      dispatchDate: shipment.dispatchDate,
      carrierName: shipment.carrier.deletedAt === null ? shipment.carrier.name : null,
      deliveryCount: shipment.deliveries.length,
      palletCount: shipment.deliveries.reduce(
        (count, delivery) => count + delivery.pallets.length,
        0
      ),
    })),
    todaySummary: {
      todayOrders: total,
      assigned,
      awaitingPalletData,
      unassigned,
      remaining: remainingOrders.length,
      ...weightCounts,
    },
  };
}
