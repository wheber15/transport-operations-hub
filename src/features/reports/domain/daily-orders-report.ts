import { estimatePalletCount } from "@/features/orders/domain/pallets";

export const dailyOrdersReportTemplateVersion = "1.0";
export const defaultTrailerCapacity = 26;

export type ReportExceptionSeverity = "High" | "Medium" | "Information";

export type DailyOrdersReportRow = {
  deliveryId: string;
  deliveryNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  shipToNumber: string | null;
  routeCode: string | null;
  goodsIssueDate: Date | null;
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
  shipmentDeliveryDate: Date | null;
  shipmentIsActive: boolean;
  carrierName: string | null;
  assignmentStatus: "assigned" | "awaitingShipment";
  palletStatus: "awaiting" | "captured";
  hasActualWeight: boolean;
};

export type DailyOrdersException = {
  severity: ReportExceptionSeverity;
  category: string;
  deliveryId: string;
  deliveryNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  explanation: string;
  suggestedAction: string;
};

export type TrailerPlanning = {
  capacity: number;
  trailersRequired: number;
  plannedCapacity: number;
  unusedCapacity: number;
  capacityUtilisation: number | null;
  breakdown: number[];
};

export type DailyOrdersKpis = {
  totalOrders: number;
  totalDeliveries: number;
  totalSapWeightKg: string | null;
  totalActualWeightKg: string | null;
  comparableSapWeightKg: string | null;
  comparableActualWeightKg: string | null;
  weightVarianceKg: string | null;
  weightVariancePercentage: number | null;
  estimatedPallets: number;
  actualPallets: number;
  palletVariance: number | null;
  deliveriesWithActualWeight: number;
  deliveriesMissingActualWeight: number;
  actualWeightCoveragePercentage: number | null;
  assignedToShipment: number;
  awaitingShipment: number;
  awaitingPalletData: number;
  overdue: number;
  shipmentsCreated: number;
  remainingTrailerRequirement: number;
};

function milligrams(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) : null;
}

function kilograms(value: number) {
  return (value / 1000).toFixed(3);
}

function sumWeights(values: Array<string | null>) {
  const total = values.reduce<number>((sum, value) => sum + (milligrams(value) ?? 0), 0);
  return total === 0 ? null : kilograms(total);
}

export function planTrailers(
  estimatedPallets: number,
  capacity = defaultTrailerCapacity
): TrailerPlanning {
  const trailersRequired = estimatedPallets === 0 ? 0 : Math.ceil(estimatedPallets / capacity);
  const plannedCapacity = trailersRequired * capacity;
  const unusedCapacity = plannedCapacity - estimatedPallets;
  return {
    capacity,
    trailersRequired,
    plannedCapacity,
    unusedCapacity,
    capacityUtilisation: plannedCapacity === 0 ? null : (estimatedPallets / plannedCapacity) * 100,
    breakdown: Array.from({ length: trailersRequired }, (_, index) =>
      Math.min(capacity, estimatedPallets - index * capacity)
    ),
  };
}

export function calculateDailyOrdersKpis(
  rows: DailyOrdersReportRow[],
  totalOrders: number,
  capacity = defaultTrailerCapacity,
  currentBusinessDate: string
) {
  const primaryRows = rows.filter((row) => row.isOrderPrimaryRow);
  const estimatedPallets = primaryRows.reduce(
    (total, row) => total + (row.orderEstimatedPallets ?? 0),
    0
  );
  const actualRows = rows.filter((row) => row.hasActualWeight);
  const comparableRows = rows.filter(
    (row) => row.activeDeliveryCountForOrder === 1 && row.hasActualWeight && row.orderSapWeightKg
  );
  const comparableSapMilligrams = comparableRows.reduce(
    (total, row) => total + (milligrams(row.orderSapWeightKg) ?? 0),
    0
  );
  const comparableActualMilligrams = comparableRows.reduce(
    (total, row) => total + (milligrams(row.actualWeightKg) ?? 0),
    0
  );
  const varianceMilligrams = comparableActualMilligrams - comparableSapMilligrams;
  const overdue = rows.filter(
    (row) =>
      row.assignmentStatus === "awaitingShipment" &&
      row.goodsIssueDate &&
      row.goodsIssueDate.toISOString().slice(0, 10) < currentBusinessDate
  ).length;
  const shipmentIds = new Set(rows.flatMap((row) => (row.shipmentId ? [row.shipmentId] : [])));
  const trailerPlanning = planTrailers(estimatedPallets, capacity);

  const kpis: DailyOrdersKpis = {
    totalOrders,
    totalDeliveries: rows.length,
    totalSapWeightKg: sumWeights(primaryRows.map((row) => row.orderSapWeightKg)),
    totalActualWeightKg: sumWeights(actualRows.map((row) => row.actualWeightKg)),
    comparableSapWeightKg:
      comparableSapMilligrams === 0 ? null : kilograms(comparableSapMilligrams),
    comparableActualWeightKg:
      comparableActualMilligrams === 0 ? null : kilograms(comparableActualMilligrams),
    weightVarianceKg: comparableRows.length === 0 ? null : kilograms(varianceMilligrams),
    weightVariancePercentage:
      comparableSapMilligrams === 0 || comparableRows.length === 0
        ? null
        : (varianceMilligrams / comparableSapMilligrams) * 100,
    estimatedPallets,
    actualPallets: rows.reduce((total, row) => total + (row.actualPallets ?? 0), 0),
    palletVariance:
      comparableRows.length === 0
        ? null
        : comparableRows.reduce((total, row) => total + (row.palletVariance ?? 0), 0),
    deliveriesWithActualWeight: actualRows.length,
    deliveriesMissingActualWeight: rows.length - actualRows.length,
    actualWeightCoveragePercentage:
      rows.length === 0 ? null : (actualRows.length / rows.length) * 100,
    assignedToShipment: rows.filter((row) => row.assignmentStatus === "assigned").length,
    awaitingShipment: rows.filter((row) => row.assignmentStatus === "awaitingShipment").length,
    awaitingPalletData: rows.filter((row) => row.palletStatus === "awaiting").length,
    overdue,
    shipmentsCreated: shipmentIds.size,
    remainingTrailerRequirement: Math.max(0, trailerPlanning.trailersRequired - shipmentIds.size),
  };

  return { kpis, trailerPlanning };
}

export function orderEstimatedPallets(sapWeightKg: string | null) {
  return estimatePalletCount(sapWeightKg);
}

export function createDailyOrdersExceptions(
  rows: DailyOrdersReportRow[],
  currentBusinessDate: string
) {
  const exceptions: DailyOrdersException[] = [];
  for (const row of rows) {
    const dueDate = row.goodsIssueDate?.toISOString().slice(0, 10) ?? null;
    const overdue =
      row.assignmentStatus === "awaitingShipment" &&
      dueDate !== null &&
      dueDate < currentBusinessDate;
    const dueTodayOrEarlier = dueDate !== null && dueDate <= currentBusinessDate;
    const base = {
      deliveryId: row.deliveryId,
      deliveryNumber: row.deliveryNumber,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
    };
    if (overdue)
      exceptions.push({
        ...base,
        severity: "High",
        category: "Overdue",
        explanation: "Goods Issue date has passed and the Delivery is awaiting Shipment.",
        suggestedAction:
          "Assign the Delivery to an active Shipment or resolve the planning exception.",
      });
    if (row.assignmentStatus === "awaitingShipment")
      exceptions.push({
        ...base,
        severity: overdue ? "High" : "Information",
        category: "Awaiting Shipment",
        explanation: "The Delivery is not assigned to an active Shipment.",
        suggestedAction: "Plan the Delivery into an active Shipment.",
      });
    if (row.palletStatus === "awaiting" && dueTodayOrEarlier)
      exceptions.push({
        ...base,
        severity: "Medium",
        category: "Awaiting pallet data",
        explanation: "No active pallet records are available for this Delivery.",
        suggestedAction: "Record confirmed pallet weights after warehouse picking.",
      });
    if (!row.hasActualWeight && row.palletStatus === "captured")
      exceptions.push({
        ...base,
        severity: "Medium",
        category: "Missing actual weight",
        explanation: "Pallet data is present but no valid actual weight is available.",
        suggestedAction: "Verify the captured pallet weights.",
      });
    if (row.palletVariance !== null)
      exceptions.push({
        ...base,
        severity: "Information",
        category: "Estimated versus actual pallet variance",
        explanation: `Actual pallet count differs from the Order-level estimate by ${row.palletVariance}.`,
        suggestedAction: "Review the variance; it does not indicate incomplete capture.",
      });
    if (row.weightVarianceKg !== null)
      exceptions.push({
        ...base,
        severity: "Information",
        category: "SAP versus actual weight variance",
        explanation: `Comparable actual weight differs from Order SAP weight by ${row.weightVarianceKg} kg.`,
        suggestedAction: "Review the measured pallet weights and SAP order weight.",
      });
    if (!row.routeCode)
      exceptions.push({
        ...base,
        severity: "Information",
        category: "Missing route",
        explanation: "No route is recorded on the Sales Order.",
        suggestedAction: "Review the operational route information.",
      });
    if (!row.shipToNumber)
      exceptions.push({
        ...base,
        severity: "Information",
        category: "Missing Ship-To",
        explanation: "No Ship-To value is recorded on the Sales Order.",
        suggestedAction: "Review the SAP Ship-To information.",
      });
    if (row.assignmentStatus === "assigned" && row.shipmentIsActive && !row.carrierName)
      exceptions.push({
        ...base,
        severity: "Medium",
        category: "Missing Carrier",
        explanation: "The active Shipment has no valid active Carrier relationship.",
        suggestedAction: "Review the Shipment Carrier assignment.",
      });
    if (row.assignmentStatus === "assigned" && row.shipmentIsActive && !row.shipmentDeliveryDate)
      exceptions.push({
        ...base,
        severity: "Medium",
        category: "Missing Delivery Date",
        explanation: "The active Shipment has no Delivery Date.",
        suggestedAction: "Set the Shipment Delivery Date according to the dispatch planning rules.",
      });
  }
  return exceptions;
}
