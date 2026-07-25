import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  dailyOrdersXlsxFileName,
  safeExcelText,
} from "@/features/reports/domain/daily-orders-xlsx";
import { renderDailyOrdersXlsx } from "./daily-orders-xlsx-renderer";

const date = new Date("2026-07-23T00:00:00.000Z");
const row = {
  deliveryId: "d1",
  deliveryNumber: "=9108325191",
  orderId: "o1",
  orderNumber: "+1046262594",
  customerName: "@Customer",
  shipToNumber: "\t85287",
  routeCode: "-IE12I1",
  goodsIssueDate: "2026-07-23",
  orderSapWeightKg: "1500",
  orderEstimatedPallets: 1,
  isOrderPrimaryRow: true,
  activeDeliveryCountForOrder: 1,
  actualWeightKg: null,
  actualPallets: null,
  weightVarianceKg: null,
  palletVariance: null,
  shipmentNumber: null,
  shipmentId: null,
  shipmentDeliveryDate: null,
  shipmentIsActive: false,
  carrierName: "=Carrier",
  assignmentStatus: "awaitingShipment" as const,
  palletStatus: "awaiting" as const,
  hasActualWeight: false,
};
const input = {
  reference: "AXR-ORD-20260723-001",
  scopeStartDate: date,
  scopeEndDate: date,
  referenceBusinessDate: date,
  requestedByDisplayName: "=Planner",
  requestedByRole: "Planner",
  createdAt: date,
  generationCompletedAt: date,
  snapshotSchemaVersion: "1.0",
  datasetVersion: "1.0",
  datasetChecksum: "a".repeat(64),
  templateVersion: "1.0",
  filters: { route: "=IE12I1" },
  rows: [row],
  kpis: {
    totalOrders: 1,
    totalDeliveries: 1,
    totalSapWeightKg: "1500",
    totalActualWeightKg: null,
    comparableSapWeightKg: null,
    comparableActualWeightKg: null,
    weightVarianceKg: null,
    weightVariancePercentage: null,
    estimatedPallets: 1,
    actualPallets: 0,
    palletVariance: null,
    deliveriesWithActualWeight: 0,
    deliveriesMissingActualWeight: 1,
    actualWeightCoveragePercentage: 0,
    assignedToShipment: 0,
    awaitingShipment: 1,
    awaitingPalletData: 1,
    overdue: 0,
    shipmentsCreated: 0,
    remainingTrailerRequirement: 1,
  },
  exceptions: {
    total: 1,
    bySeverity: { High: 1 },
    byCategory: { Overdue: 1 },
    items: [
      {
        severity: "High" as const,
        category: "=Overdue",
        deliveryNumber: "=9108325191",
        orderNumber: "+1046262594",
        customerName: "@Customer",
        explanation: "\tReview",
        suggestedAction: "\nPlan",
      },
    ],
  },
};

describe("Daily Orders XLSX renderer", () => {
  it("creates the required ordered sheets from snapshot input with safe text", async () => {
    const content = await renderDailyOrdersXlsx(input);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(content).buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Executive Summary",
      "Daily Orders",
      "Items Requiring Attention",
      "Trailer Planning",
      "Weight Analysis",
      "Pallet Analysis",
      "Report Metadata",
    ]);
    expect(workbook.getWorksheet("Daily Orders")?.getCell("A6").value).toBe("'=9108325191");
    expect(workbook.getWorksheet("Daily Orders")?.getCell("G7").value).toBe(1500);
    expect(workbook.getWorksheet("Executive Summary")?.getCell("B6").value).toBe(1);
    const summary = workbook.getWorksheet("Executive Summary");
    expect(summary?.getCell("B10").numFmt).toBe('#,##0.000 "kg"');
    expect(summary?.getCell("B12").numFmt).toBe("0.0%");
    expect(summary?.getCell("B6").numFmt).toBe("#,##0");
    expect(workbook.getWorksheet("Daily Orders")?.views[0]?.state).toBe("frozen");
    expect(workbook.getWorksheet("Daily Orders")?.autoFilter).toBeTruthy();
  });
  it("uses safe Windows filenames and escapes formula-like text", () => {
    expect(dailyOrdersXlsxFileName(date, "AXR/ORD:20260723-001")).toBe(
      "AXon Daily Orders Report - 2026-07-23 - AXRORD20260723-001.xlsx"
    );
    expect(safeExcelText("=formula")).toBe("'=formula");
    expect(safeExcelText("normal")).toBe("normal");
  });

  it("writes a review-only workbook outside public storage when explicitly requested", async () => {
    if (process.env.WRITE_REPORT_REVIEW_SAMPLE !== "1") return;
    const reviewDirectory = join(process.cwd(), ".review-artifacts");
    const fileName = "AXon Daily Orders Report - 2026-07-23 - AXR-ORD-20260723-001.xlsx";
    await mkdir(reviewDirectory, { recursive: true });
    await writeFile(join(reviewDirectory, fileName), await renderDailyOrdersXlsx(input));
  });
});
