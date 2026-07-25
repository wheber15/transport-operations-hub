import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { calculatePalletWeightSummary } from "@/features/orders/domain/pallets";
import {
  calculateDailyOrdersKpis,
  createDailyOrdersExceptions,
  orderEstimatedPallets,
  type DailyOrdersReportRow,
} from "@/features/reports/domain/daily-orders-report";
import type { DailyOrdersReportFilters } from "@/features/reports/validation/report-schemas";

export function buildDailyOrdersReportWhere(
  filters: DailyOrdersReportFilters
): Prisma.OrderWhereInput {
  const query = filters.query;
  const requiresDeliveryMatch =
    filters.shipmentState !== "all" || filters.palletState !== "all" || Boolean(filters.carrier);
  return {
    ...(filters.recordState === "active"
      ? { deletedAt: null }
      : filters.recordState === "deleted"
        ? { deletedAt: { not: null } }
        : {}),
    ...(filters.from || filters.to
      ? {
          goodsIssueDate: {
            ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
            ...(filters.to ? { lte: new Date(`${filters.to}T00:00:00.000Z`) } : {}),
          },
        }
      : {}),
    ...(filters.customer
      ? { customer: { name: { contains: filters.customer, mode: "insensitive" } } }
      : {}),
    ...(filters.route ? { routeCode: { equals: filters.route, mode: "insensitive" } } : {}),
    ...(filters.shipTo ? { shipToNumber: { equals: filters.shipTo, mode: "insensitive" } } : {}),
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { pickingNumber: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
            { shipToNumber: { contains: query, mode: "insensitive" } },
            { routeCode: { contains: query, mode: "insensitive" } },
            {
              deliveries: {
                some: { deletedAt: null, deliveryNumber: { contains: query, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
    ...(requiresDeliveryMatch ? { deliveries: { some: reportDeliveryWhere(filters) } } : {}),
  };
}

function reportDeliveryWhere(filters: DailyOrdersReportFilters): Prisma.DeliveryWhereInput {
  return {
    deletedAt: null,
    ...(filters.shipmentState === "assigned"
      ? { shipmentId: { not: null } }
      : filters.shipmentState === "unassigned"
        ? { shipmentId: null }
        : {}),
    ...(filters.palletState === "awaiting"
      ? { pallets: { none: { deletedAt: null } } }
      : filters.palletState === "captured"
        ? { pallets: { some: { deletedAt: null } } }
        : {}),
    ...(filters.carrier
      ? {
          shipment: {
            is: {
              carrier: {
                is: { name: { contains: filters.carrier, mode: "insensitive" }, deletedAt: null },
              },
            },
          },
        }
      : {}),
  };
}

const reportOrderSelect = {
  id: true,
  orderNumber: true,
  goodsIssueDate: true,
  shipToNumber: true,
  routeCode: true,
  grossWeightKg: true,
  customer: { select: { name: true, deletedAt: true } },
  deliveries: {
    where: { deletedAt: null },
    orderBy: [{ deliveryNumber: "asc" }, { id: "asc" }],
    select: {
      id: true,
      deliveryNumber: true,
      shipmentId: true,
      pallets: { where: { deletedAt: null }, select: { actualWeight: true } },
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          deliveryDate: true,
          deletedAt: true,
          carrier: { select: { name: true, deletedAt: true } },
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

type ReportOrderRecord = Prisma.OrderGetPayload<{ select: typeof reportOrderSelect }>;

function toRows(
  records: ReportOrderRecord[],
  filters: DailyOrdersReportFilters
): DailyOrdersReportRow[] {
  const matchesDelivery = (delivery: ReportOrderRecord["deliveries"][number]) => {
    if (filters.shipmentState === "assigned" && !delivery.shipmentId) return false;
    if (filters.shipmentState === "unassigned" && delivery.shipmentId) return false;
    if (filters.palletState === "awaiting" && delivery.pallets.length > 0) return false;
    if (filters.palletState === "captured" && delivery.pallets.length === 0) return false;
    if (
      filters.carrier &&
      (!delivery.shipment ||
        delivery.shipment.carrier.deletedAt !== null ||
        !delivery.shipment.carrier.name.toLowerCase().includes(filters.carrier.toLowerCase()))
    )
      return false;
    return true;
  };
  return records.flatMap((order) => {
    const weight = order.grossWeightKg?.toFixed(3) ?? null;
    const eligibleDeliveries = order.deliveries.filter(matchesDelivery);
    return eligibleDeliveries.map((delivery, index) => {
      const pallets = delivery.pallets.map((pallet) => pallet.actualWeight.toFixed(3));
      const isComparable = order.deliveries.length === 1;
      const palletSummary = calculatePalletWeightSummary(pallets, isComparable ? weight : null);
      const shipmentActive = delivery.shipment?.deletedAt === null;
      return {
        deliveryId: delivery.id,
        deliveryNumber: delivery.deliveryNumber,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.deletedAt === null ? order.customer.name : null,
        shipToNumber: order.shipToNumber,
        routeCode: order.routeCode,
        goodsIssueDate: order.goodsIssueDate,
        orderSapWeightKg: weight,
        orderEstimatedPallets: orderEstimatedPallets(weight),
        isOrderPrimaryRow: index === 0,
        activeDeliveryCountForOrder: order.deliveries.length,
        actualWeightKg: palletSummary.actualPalletWeightKg,
        actualPallets: pallets.length || null,
        weightVarianceKg: isComparable ? palletSummary.varianceKg : null,
        palletVariance:
          isComparable && palletSummary.palletCount > 0 && orderEstimatedPallets(weight) !== null
            ? palletSummary.palletCount - orderEstimatedPallets(weight)!
            : null,
        shipmentNumber: shipmentActive ? (delivery.shipment?.shipmentNumber ?? null) : null,
        shipmentId: shipmentActive ? delivery.shipmentId : null,
        shipmentDeliveryDate: shipmentActive ? (delivery.shipment?.deliveryDate ?? null) : null,
        shipmentIsActive: shipmentActive,
        carrierName:
          shipmentActive && delivery.shipment?.carrier.deletedAt === null
            ? delivery.shipment.carrier.name
            : null,
        assignmentStatus: shipmentActive ? "assigned" : "awaitingShipment",
        palletStatus: pallets.length ? "captured" : "awaiting",
        hasActualWeight: palletSummary.actualPalletWeightKg !== null,
      };
    });
  });
}

export async function getDailyOrdersReportData(
  filters: DailyOrdersReportFilters,
  currentBusinessDate: string
) {
  const where = buildDailyOrdersReportWhere(filters);
  const [orders, capacitySetting] = await Promise.all([
    prisma.order.findMany({
      where,
      select: reportOrderSelect,
      orderBy: [{ orderNumber: "asc" }, { id: "asc" }],
    }),
    prisma.appSetting.findUnique({
      where: { key: "reports.trailerCapacity" },
      select: { value: true },
    }),
  ]);
  const rows = toRows(orders, filters);
  const capacity =
    typeof capacitySetting?.value === "number" && capacitySetting.value > 0
      ? Math.floor(capacitySetting.value)
      : 26;
  const { kpis, trailerPlanning } = calculateDailyOrdersKpis(
    rows,
    orders.length,
    capacity,
    currentBusinessDate
  );
  const exceptions = createDailyOrdersExceptions(rows, currentBusinessDate);
  const start = (filters.page - 1) * filters.pageSize;
  return {
    rows: rows.slice(start, start + filters.pageSize),
    normalizedRows: rows,
    totalRows: rows.length,
    kpis,
    trailerPlanning,
    exceptions,
  };
}
