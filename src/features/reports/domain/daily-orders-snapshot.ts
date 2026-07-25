import type {
  DailyOrdersException,
  DailyOrdersKpis,
  DailyOrdersReportRow,
} from "@/features/reports/domain/daily-orders-report";

export type DailyOrdersSnapshotRow = {
  deliveryId: string;
  deliveryNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  shipToNumber: string | null;
  routeCode: string | null;
  goodsIssueDate: string | null;
  orderSapWeightKg: string | null;
  orderEstimatedPallets: number | null;
  isOrderPrimaryRow: boolean;
  activeDeliveryCountForOrder: number;
  actualWeightKg: string | null;
  actualPallets: number | null;
  weightVarianceKg: string | null;
  palletVariance: number | null;
  shipmentNumber: string | null;
  shipmentId: string | null;
  shipmentDeliveryDate: string | null;
  shipmentIsActive: boolean;
  carrierName: string | null;
  assignmentStatus: "assigned" | "awaitingShipment";
  palletStatus: "awaiting" | "captured";
  hasActualWeight: boolean;
};

function date(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function normalizeDailyOrdersSnapshotRows(
  rows: DailyOrdersReportRow[]
): DailyOrdersSnapshotRow[] {
  return rows.map((row) => ({
    deliveryId: row.deliveryId,
    deliveryNumber: row.deliveryNumber,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    customerName: row.customerName,
    shipToNumber: row.shipToNumber,
    routeCode: row.routeCode,
    goodsIssueDate: date(row.goodsIssueDate),
    orderSapWeightKg: row.orderSapWeightKg,
    orderEstimatedPallets: row.orderEstimatedPallets,
    isOrderPrimaryRow: row.isOrderPrimaryRow,
    activeDeliveryCountForOrder: row.activeDeliveryCountForOrder,
    actualWeightKg: row.actualWeightKg,
    actualPallets: row.actualPallets,
    weightVarianceKg: row.weightVarianceKg,
    palletVariance: row.palletVariance,
    shipmentNumber: row.shipmentNumber,
    shipmentId: row.shipmentId,
    shipmentDeliveryDate: date(row.shipmentDeliveryDate),
    shipmentIsActive: row.shipmentIsActive,
    carrierName: row.carrierName,
    assignmentStatus: row.assignmentStatus,
    palletStatus: row.palletStatus,
    hasActualWeight: row.hasActualWeight,
  }));
}

export function exceptionSnapshot(exceptions: DailyOrdersException[]) {
  const bySeverity = exceptions.reduce<Record<string, number>>((summary, exception) => {
    summary[exception.severity] = (summary[exception.severity] ?? 0) + 1;
    return summary;
  }, {});
  const byCategory = exceptions.reduce<Record<string, number>>((summary, exception) => {
    summary[exception.category] = (summary[exception.category] ?? 0) + 1;
    return summary;
  }, {});
  return {
    total: exceptions.length,
    bySeverity,
    byCategory,
    items: exceptions.map((exception) => ({
      severity: exception.severity,
      category: exception.category,
      deliveryId: exception.deliveryId,
      deliveryNumber: exception.deliveryNumber,
      orderId: exception.orderId,
      orderNumber: exception.orderNumber,
      customerName: exception.customerName,
      explanation: exception.explanation,
      suggestedAction: exception.suggestedAction,
    })),
  };
}

export function kpiSnapshot(kpis: DailyOrdersKpis) {
  return { ...kpis };
}
