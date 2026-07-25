import { createHash } from "node:crypto";

import { z } from "zod";

import {
  defaultTrailerCapacity,
  planTrailers,
} from "@/features/reports/domain/daily-orders-report";
import type { DailyOrdersSnapshotRow } from "@/features/reports/domain/daily-orders-snapshot";

export const dailyOrdersXlsxContentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const maximumDailyOrdersXlsxRows = 5000;

const nullableText = z.string().nullable();
export const dailyOrdersSnapshotRowSchema = z.object({
  deliveryId: z.string(),
  deliveryNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerName: nullableText,
  shipToNumber: nullableText,
  routeCode: nullableText,
  goodsIssueDate: nullableText,
  orderSapWeightKg: nullableText,
  orderEstimatedPallets: z.number().int().nullable(),
  isOrderPrimaryRow: z.boolean(),
  activeDeliveryCountForOrder: z.number().int().nonnegative(),
  actualWeightKg: nullableText,
  actualPallets: z.number().int().nullable(),
  weightVarianceKg: nullableText,
  palletVariance: z.number().int().nullable(),
  shipmentNumber: nullableText,
  shipmentId: nullableText,
  shipmentDeliveryDate: nullableText,
  shipmentIsActive: z.boolean(),
  carrierName: nullableText,
  assignmentStatus: z.enum(["assigned", "awaitingShipment"]),
  palletStatus: z.enum(["awaiting", "captured"]),
  hasActualWeight: z.boolean(),
});

export type StoredDailyOrdersKpis = {
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

export type StoredDailyOrdersException = {
  severity: "High" | "Medium" | "Information";
  category: string;
  deliveryNumber: string;
  orderNumber: string;
  customerName: string | null;
  explanation: string;
  suggestedAction: string;
};
export type StoredDailyOrdersExceptionSummary = {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  items: StoredDailyOrdersException[];
};

const kpisSchema = z.object({
  totalOrders: z.number(),
  totalDeliveries: z.number(),
  totalSapWeightKg: nullableText,
  totalActualWeightKg: nullableText,
  comparableSapWeightKg: nullableText,
  comparableActualWeightKg: nullableText,
  weightVarianceKg: nullableText,
  weightVariancePercentage: z.number().nullable(),
  estimatedPallets: z.number(),
  actualPallets: z.number(),
  palletVariance: z.number().nullable(),
  deliveriesWithActualWeight: z.number(),
  deliveriesMissingActualWeight: z.number(),
  actualWeightCoveragePercentage: z.number().nullable(),
  assignedToShipment: z.number(),
  awaitingShipment: z.number(),
  awaitingPalletData: z.number(),
  overdue: z.number(),
  shipmentsCreated: z.number(),
  remainingTrailerRequirement: z.number(),
});
const exceptionSummarySchema = z.object({
  total: z.number(),
  bySeverity: z.record(z.string(), z.number()),
  byCategory: z.record(z.string(), z.number()),
  items: z.array(
    z.object({
      severity: z.enum(["High", "Medium", "Information"]),
      category: z.string(),
      deliveryNumber: z.string(),
      orderNumber: z.string(),
      customerName: nullableText,
      explanation: z.string(),
      suggestedAction: z.string(),
    })
  ),
});

export function parseStoredDailyOrdersKpis(value: unknown): StoredDailyOrdersKpis {
  return kpisSchema.parse(value);
}
export function parseStoredDailyOrdersExceptions(
  value: unknown
): StoredDailyOrdersExceptionSummary {
  return exceptionSummarySchema.parse(value);
}
export function parseStoredDailyOrdersRow(value: unknown): DailyOrdersSnapshotRow {
  return dailyOrdersSnapshotRowSchema.parse(value);
}

export function safeExcelText(value: string | null | undefined) {
  if (value === null || value === undefined) return "";
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}

export function dailyOrdersXlsxFileName(referenceBusinessDate: Date, reference: string) {
  const date = referenceBusinessDate.toISOString().slice(0, 10);
  const safeReference = reference.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
  return `AXon Daily Orders Report - ${date} - ${safeReference}.xlsx`;
}

export function sha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}
export function trailerPlan(kpis: StoredDailyOrdersKpis) {
  return planTrailers(kpis.estimatedPallets, defaultTrailerCapacity);
}
