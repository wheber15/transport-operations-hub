import "server-only";

import ExcelJS from "exceljs";

import {
  safeExcelText,
  trailerPlan,
  type StoredDailyOrdersExceptionSummary,
  type StoredDailyOrdersKpis,
} from "@/features/reports/domain/daily-orders-xlsx";
import type { DailyOrdersSnapshotRow } from "@/features/reports/domain/daily-orders-snapshot";

type Input = {
  reference: string;
  scopeStartDate: Date;
  scopeEndDate: Date;
  referenceBusinessDate: Date;
  requestedByDisplayName: string;
  requestedByRole: string;
  createdAt: Date;
  generationCompletedAt: Date | null;
  snapshotSchemaVersion: string;
  datasetVersion: string;
  datasetChecksum: string;
  templateVersion: string;
  filters: Record<string, unknown>;
  kpis: StoredDailyOrdersKpis;
  exceptions: StoredDailyOrdersExceptionSummary;
  rows: DailyOrdersSnapshotRow[];
};
const border = { style: "thin" as const, color: { argb: "D1D5DB" } };
const titleFill = "0B1F3A";
const accentFill = "0B63CE";
const lightFill = "EAF2FC";
const wholeNumber = "#,##0";
const weightNumber = '#,##0.000 "kg"';
const percentage = "0.0%";
function kpiFormat(label: string) {
  if (label.includes("Coverage") || label.includes("Percentage") || label.includes("Utilisation"))
    return percentage;
  if (label.includes("Weight")) return weightNumber;
  return wholeNumber;
}
function setup(sheet: ExcelJS.Worksheet, title: string, input: Input) {
  sheet.properties.defaultRowHeight = 17;
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = "AXon | Operations Hub";
  sheet.getCell("A1").font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: titleFill } };
  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = { name: "Arial", size: 20, bold: true, color: { argb: "FFFFFF" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: accentFill } };
  sheet.getCell("A3").value =
    `Report ${safeExcelText(input.reference)} | ${input.scopeStartDate.toISOString().slice(0, 10)} to ${input.scopeEndDate.toISOString().slice(0, 10)}`;
  sheet.mergeCells("A3:H3");
  sheet.getCell("A3").font = { name: "Arial", size: 10, italic: true };
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.pageSetup.margins = {
    left: 0.3,
    right: 0.3,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };
}
function heading(sheet: ExcelJS.Worksheet, row: number, values: string[]) {
  const r = sheet.getRow(row);
  values.forEach((value, index) => {
    const c = r.getCell(index + 1);
    c.value = value;
    c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: titleFill } };
    c.border = { bottom: border };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  r.height = 30;
}
function dataRow(sheet: ExcelJS.Worksheet, values: Array<string | number | null | boolean>) {
  const r = sheet.addRow(values);
  r.font = { name: "Arial", size: 10 };
  r.eachCell((cell) => {
    cell.border = { bottom: border };
    cell.alignment = { vertical: "top", wrapText: true };
  });
  return r;
}
function metricTable(
  sheet: ExcelJS.Worksheet,
  start: number,
  title: string,
  items: Array<[string, string | number | null]>
) {
  sheet.getCell(start, 1).value = title;
  sheet.getCell(start, 1).font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
  sheet.getCell(start, 1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: accentFill },
  };
  for (const [i, [label, value]] of items.entries()) {
    const row = start + i + 1;
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 2).value = value;
    sheet.getCell(row, 1).font = { name: "Arial", size: 10 };
    sheet.getCell(row, 1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: lightFill },
    };
    sheet.getCell(row, 2).font = { name: "Arial", size: 10, bold: true };
    sheet.getCell(row, 2).alignment = { horizontal: "right" };
    sheet.getCell(row, 2).numFmt = kpiFormat(label);
  }
  return start + items.length + 2;
}
const kg = (v: string | null) => (v === null ? null : Number(v));
const pct = (v: number | null) => (v === null ? null : v / 100);
function addSummary(workbook: ExcelJS.Workbook, input: Input) {
  const s = workbook.addWorksheet("Executive Summary");
  setup(s, "Daily Orders Report", input);
  let row = 5;
  const k = input.kpis;
  row = metricTable(s, row, "Orders", [
    ["Total Orders", k.totalOrders],
    ["Total Deliveries", k.totalDeliveries],
  ]);
  row = metricTable(s, row, "Weight", [
    ["Total SAP Weight (kg)", kg(k.totalSapWeightKg)],
    ["Total Actual Weight (kg)", kg(k.totalActualWeightKg)],
    ["Actual Weight Coverage", pct(k.actualWeightCoveragePercentage)],
    ["Comparable SAP Weight (kg)", kg(k.comparableSapWeightKg)],
    ["Comparable Actual Weight (kg)", kg(k.comparableActualWeightKg)],
    ["Weight Variance (kg)", kg(k.weightVarianceKg)],
    ["Weight Variance Percentage", pct(k.weightVariancePercentage)],
  ]);
  row = metricTable(s, row, "Pallets", [
    ["Estimated Pallets", k.estimatedPallets],
    ["Actual Pallets", k.actualPallets],
    ["Deliveries with Pallet Data", k.deliveriesWithActualWeight],
    ["Deliveries Awaiting Pallet Data", k.deliveriesMissingActualWeight],
    ["Comparable Estimated Pallets", k.palletVariance === null ? null : k.estimatedPallets],
    ["Comparable Actual Pallets", k.palletVariance === null ? null : k.actualPallets],
    ["Pallet Variance", k.palletVariance],
  ]);
  const t = trailerPlan(k);
  row = metricTable(s, row, "Planning and Capacity", [
    ["Assigned to Shipment", k.assignedToShipment],
    ["Awaiting Shipment", k.awaitingShipment],
    ["Overdue", k.overdue],
    ["Trailer Capacity", t.capacity],
    ["Trailers Required", t.trailersRequired],
    ["Shipments Created", k.shipmentsCreated],
    ["Remaining Trailer Requirement", k.remainingTrailerRequirement],
    ["Planned Capacity", t.plannedCapacity],
    ["Unused Capacity", t.unusedCapacity],
    ["Capacity Utilisation", pct(t.capacityUtilisation)],
  ]);
  s.getCell(row, 1).value = "Rush classification is not yet modelled.";
  s.mergeCells(row, 1, row, 6);
  s.getCell(row + 2, 1).value =
    "SAP weight and estimated pallets are currently recorded at Sales Order level. Orders with multiple Deliveries contribute once to report totals.";
  s.mergeCells(row + 2, 1, row + 2, 8);
  s.getCell(row + 2, 1).alignment = { wrapText: true };
  s.columns = [
    { width: 38 },
    { width: 20 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];
  s.pageSetup.orientation = "portrait";
}
function addDailyOrders(workbook: ExcelJS.Workbook, input: Input) {
  const s = workbook.addWorksheet("Daily Orders");
  setup(s, "Daily Orders", input);
  const headers = [
    "Delivery Number",
    "Sales Order",
    "Customer",
    "Ship-To",
    "Route",
    "Goods Issue Date",
    "Order SAP Weight (kg)",
    "Actual Weight (kg)",
    "Weight Variance (kg)",
    "Order Estimated Pallets",
    "Actual Pallets",
    "Pallet Variance",
    "Shipment Number",
    "Carrier",
    "Assignment Status",
    "Pallet Status",
    "Overdue",
    "Order Primary Contribution Row",
    "Data Completeness Notes",
  ];
  heading(s, 5, headers);
  for (const x of input.rows) {
    const notes = [
      !x.hasActualWeight ? "Actual weight unavailable" : null,
      !x.routeCode ? "Route unavailable" : null,
      !x.shipToNumber ? "Ship-To unavailable" : null,
    ]
      .filter(Boolean)
      .join("; ");
    dataRow(s, [
      safeExcelText(x.deliveryNumber),
      safeExcelText(x.orderNumber),
      safeExcelText(x.customerName),
      safeExcelText(x.shipToNumber),
      safeExcelText(x.routeCode),
      x.goodsIssueDate,
      x.isOrderPrimaryRow ? kg(x.orderSapWeightKg) : null,
      kg(x.actualWeightKg),
      kg(x.weightVarianceKg),
      x.isOrderPrimaryRow ? x.orderEstimatedPallets : null,
      x.actualPallets,
      x.palletVariance,
      safeExcelText(x.shipmentNumber),
      safeExcelText(x.carrierName),
      x.assignmentStatus === "assigned" ? "Assigned" : "Awaiting Shipment",
      x.palletStatus === "captured" ? "Captured" : "Awaiting pallet data",
      x.assignmentStatus === "awaitingShipment" &&
      x.goodsIssueDate !== null &&
      x.goodsIssueDate < input.scopeStartDate.toISOString().slice(0, 10)
        ? "Yes"
        : "No",
      x.isOrderPrimaryRow ? "Yes" : "No",
      safeExcelText(notes),
    ]);
  }
  const r = s.addRow([
    "Totals",
    "",
    "",
    "",
    "",
    "",
    kg(input.kpis.totalSapWeightKg),
    kg(input.kpis.totalActualWeightKg),
    kg(input.kpis.weightVarianceKg),
    input.kpis.estimatedPallets,
    input.kpis.actualPallets,
    input.kpis.palletVariance,
  ]);
  r.font = { name: "Arial", size: 10, bold: true };
  s.autoFilter = { from: "A5", to: `S${Math.max(5, input.rows.length + 5)}` };
  s.pageSetup.printTitlesRow = "1:5";
  s.pageSetup.printArea = `A1:S${input.rows.length + 6}`;
  s.columns = [18, 16, 32, 16, 12, 16, 18, 18, 18, 20, 16, 16, 18, 28, 20, 20, 10, 28, 38].map(
    (width) => ({ width })
  );
  s.getColumn(6).numFmt = "yyyy-mm-dd";
  for (const c of [7, 8, 9]) s.getColumn(c).numFmt = weightNumber;
  for (const c of [10, 11, 12]) s.getColumn(c).numFmt = wholeNumber;
  for (let index = 6; index <= input.rows.length + 5; index += 1) {
    const row = s.getRow(index);
    row.height = 24;
    if (index % 2 === 0)
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      });
    [7, 8, 9, 10, 11, 12].forEach((column) => {
      row.getCell(column).alignment = { horizontal: "right", vertical: "top" };
    });
    [3, 14, 19].forEach((column) => {
      row.getCell(column).alignment = { vertical: "top", wrapText: true };
    });
  }
}
function addExceptions(workbook: ExcelJS.Workbook, input: Input) {
  const s = workbook.addWorksheet("Items Requiring Attention");
  setup(s, "Items Requiring Attention", input);
  heading(s, 5, [
    "Severity",
    "Category",
    "Delivery Number",
    "Sales Order",
    "Customer",
    "Explanation",
    "Suggested Action",
  ]);
  const order = { High: 0, Medium: 1, Information: 2 };
  const items = [...input.exceptions.items].sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      a.category.localeCompare(b.category) ||
      a.deliveryNumber.localeCompare(b.deliveryNumber)
  );
  if (!items.length) dataRow(s, ["No items require attention."]);
  else
    items.forEach((x) => {
      const row = dataRow(s, [
        x.severity,
        safeExcelText(x.category),
        safeExcelText(x.deliveryNumber),
        safeExcelText(x.orderNumber),
        safeExcelText(x.customerName),
        safeExcelText(x.explanation),
        safeExcelText(x.suggestedAction),
      ]);
      const colour =
        x.severity === "High" ? "FEE2E2" : x.severity === "Medium" ? "FEF3C7" : "DBEAFE";
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colour } };
      row.getCell(1).font = { name: "Arial", size: 10, bold: true };
    });
  s.autoFilter = { from: "A5", to: `G${Math.max(5, items.length + 5)}` };
  s.columns = [12, 28, 16, 15, 30, 54, 48].map((width) => ({ width }));
  s.pageSetup.orientation = "landscape";
  s.pageSetup.printTitlesRow = "1:5";
  for (let index = 6; index <= Math.max(6, items.length + 5); index += 1) {
    const row = s.getRow(index);
    row.height = 48;
    if (index % 2 === 0)
      row.eachCell((cell) => {
        if (!cell.fill)
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      });
  }
}
function addTrailer(workbook: ExcelJS.Workbook, input: Input) {
  const s = workbook.addWorksheet("Trailer Planning");
  setup(s, "Trailer Planning", input);
  const t = trailerPlan(input.kpis);
  metricTable(s, 5, "Planning guidance", [
    ["Estimated Pallets", input.kpis.estimatedPallets],
    ["Trailer Capacity", t.capacity],
    ["Trailers Required", t.trailersRequired],
    ["Shipments Created", input.kpis.shipmentsCreated],
    ["Remaining Trailer Requirement", input.kpis.remainingTrailerRequirement],
    ["Planned Capacity", t.plannedCapacity],
    ["Unused Capacity", t.unusedCapacity],
    ["Capacity Utilisation", pct(t.capacityUtilisation)],
  ]);
  heading(s, 15, ["Trailer", "Planned Pallets", "Capacity", "Remaining Capacity", "Utilisation"]);
  t.breakdown.forEach((p, i) =>
    dataRow(s, [
      `Trailer ${i + 1}`,
      p,
      t.capacity,
      t.capacity - p,
      t.capacity === 0 ? null : p / t.capacity,
    ])
  );
  s.getCell(17 + t.breakdown.length, 1).value =
    "Planning guidance only. Trailer rows do not represent confirmed shipment allocation.";
  s.mergeCells(17 + t.breakdown.length, 1, 17 + t.breakdown.length, 5);
  s.columns = [30, 18, 14, 20, 14, { width: 20 }, { width: 20 }, { width: 20 }];
  for (const c of [2, 3, 4]) s.getColumn(c).numFmt = wholeNumber;
  s.getColumn(5).numFmt = percentage;
  s.getCell(17 + t.breakdown.length, 1).alignment = { wrapText: true, vertical: "top" };
  s.getRow(17 + t.breakdown.length).height = 32;
}
function addWeight(workbook: ExcelJS.Workbook, input: Input) {
  const s = workbook.addWorksheet("Weight Analysis");
  setup(s, "Weight Analysis", input);
  const k = input.kpis;
  metricTable(s, 5, "Weight", [
    ["Total SAP Weight", kg(k.totalSapWeightKg)],
    ["Total Actual Weight", kg(k.totalActualWeightKg)],
    ["Actual Weight Coverage", pct(k.actualWeightCoveragePercentage)],
    ["Comparable SAP Weight", kg(k.comparableSapWeightKg)],
    ["Comparable Actual Weight", kg(k.comparableActualWeightKg)],
    ["Weight Variance", kg(k.weightVarianceKg)],
    ["Weight Variance Percentage", pct(k.weightVariancePercentage)],
    ["Deliveries with actual weight", k.deliveriesWithActualWeight],
    ["Deliveries missing actual weight", k.deliveriesMissingActualWeight],
  ]);
  heading(s, 16, [
    "Delivery Number",
    "Sales Order",
    "Customer",
    "Order SAP Weight",
    "Actual Weight",
    "Variance",
    "Variance Percentage",
    "Comparison Qualification",
  ]);
  input.rows
    .filter((x) => x.activeDeliveryCountForOrder === 1 && x.hasActualWeight && x.orderSapWeightKg)
    .forEach((x) =>
      dataRow(s, [
        safeExcelText(x.deliveryNumber),
        safeExcelText(x.orderNumber),
        safeExcelText(x.customerName),
        kg(x.orderSapWeightKg),
        kg(x.actualWeightKg),
        kg(x.weightVarianceKg),
        x.orderSapWeightKg && x.weightVarianceKg
          ? Number(x.weightVarianceKg) / Number(x.orderSapWeightKg)
          : null,
        "Single-delivery Order with actual weight",
      ])
    );
  s.columns = [20, 18, 30, 20, 18, 16, 20, 42].map((width) => ({ width }));
  for (const c of [4, 5, 6]) s.getColumn(c).numFmt = weightNumber;
  s.getColumn(7).numFmt = percentage;
}
function addPallets(workbook: ExcelJS.Workbook, input: Input) {
  const s = workbook.addWorksheet("Pallet Analysis");
  setup(s, "Pallet Analysis", input);
  const k = input.kpis;
  metricTable(s, 5, "Pallets", [
    ["Estimated Pallets", k.estimatedPallets],
    ["Actual Pallets", k.actualPallets],
    [
      "Pallet Data Coverage",
      k.totalDeliveries === 0 ? null : k.deliveriesWithActualWeight / k.totalDeliveries,
    ],
    ["Comparable Estimated Pallets", k.palletVariance === null ? null : k.estimatedPallets],
    ["Comparable Actual Pallets", k.palletVariance === null ? null : k.actualPallets],
    ["Pallet Variance", k.palletVariance],
    ["Deliveries with pallet data", k.deliveriesWithActualWeight],
    ["Deliveries awaiting pallet data", k.deliveriesMissingActualWeight],
  ]);
  heading(s, 15, [
    "Delivery Number",
    "Sales Order",
    "Customer",
    "Order Estimated Pallets",
    "Actual Pallets",
    "Variance",
    "Comparison Qualification",
  ]);
  input.rows
    .filter((x) => x.activeDeliveryCountForOrder === 1 && x.actualPallets !== null)
    .forEach((x) =>
      dataRow(s, [
        safeExcelText(x.deliveryNumber),
        safeExcelText(x.orderNumber),
        safeExcelText(x.customerName),
        x.orderEstimatedPallets,
        x.actualPallets,
        x.palletVariance,
        "Single-delivery Order with captured pallet data",
      ])
    );
  s.columns = [20, 18, 30, 24, 18, 16, 44].map((width) => ({ width }));
  for (const c of [4, 5, 6]) s.getColumn(c).numFmt = wholeNumber;
}
function addMetadata(workbook: ExcelJS.Workbook, input: Input) {
  const s = workbook.addWorksheet("Report Metadata");
  setup(s, "Report Metadata", input);
  const reportFields: Array<[string, string | number | null]> = [
    ["Report Reference", input.reference],
    ["Report Type", "Daily Orders"],
    ["Scope Start Date", input.scopeStartDate.toISOString().slice(0, 10)],
    ["Scope End Date", input.scopeEndDate.toISOString().slice(0, 10)],
    ["Reference Business Date", input.referenceBusinessDate.toISOString().slice(0, 10)],
    ["Generated By", safeExcelText(input.requestedByDisplayName)],
    ["Generated By Role", safeExcelText(input.requestedByRole)],
    ["Requested At", input.createdAt.toISOString()],
    ["Generation Completed At", input.generationCompletedAt?.toISOString() ?? null],
  ];
  const technicalFields: Array<[string, string | number | null]> = [
    ["Snapshot Schema Version", input.snapshotSchemaVersion],
    ["Dataset Version", input.datasetVersion],
    ["Dataset Checksum", input.datasetChecksum],
    ["Template Version", input.templateVersion],
    ["Row Count", input.rows.length],
    ["Exception Count", input.exceptions.total],
    ["XLSX Artifact Checksum", "Available after generation"],
    ["Classification", "Internal Operational Report"],
    ["System Name", "AXon Operations Hub"],
  ];
  heading(s, 5, ["Report Information", "Value"]);
  reportFields.forEach(([a, b]) =>
    dataRow(s, [safeExcelText(a), typeof b === "string" ? safeExcelText(b) : b])
  );
  const technicalStart = reportFields.length + 7;
  heading(s, technicalStart, ["Technical Information", "Value"]);
  technicalFields.forEach(([a, b]) =>
    dataRow(s, [safeExcelText(a), typeof b === "string" ? safeExcelText(b) : b])
  );
  const start = technicalStart + technicalFields.length + 2;
  heading(s, start, ["Normalized Filter", "Value"]);
  Object.entries(input.filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([a, b]) =>
      dataRow(s, [safeExcelText(a), safeExcelText(b === null ? "" : String(b))])
    );
  s.columns = [
    34,
    90,
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
  ];
  for (let index = 6; index <= s.rowCount; index += 1) {
    s.getRow(index).height = 30;
    s.getRow(index).getCell(2).alignment = { wrapText: true, vertical: "top" };
  }
}
export async function renderDailyOrdersXlsx(input: Input) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AXon Operations Hub";
  workbook.created = input.createdAt;
  workbook.modified = input.generationCompletedAt ?? input.createdAt;
  workbook.title = "AXon Daily Orders Report";
  workbook.subject = `Report ${input.reference}`;
  workbook.company = "AXon";
  addSummary(workbook, input);
  addDailyOrders(workbook, input);
  addExceptions(workbook, input);
  addTrailer(workbook, input);
  addWeight(workbook, input);
  addPallets(workbook, input);
  addMetadata(workbook, input);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
