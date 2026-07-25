import { createHash } from "node:crypto";

import { calculatePlannedPalletUnit } from "@/features/carrier-exports/domain/planned-pallets";

export const dachserHeaders = [
  "Shipment Number",
  "Sales Order Number",
  "Delivery",
  "Ship-To Party",
  "Sold-to Name1",
  "Ship-to Name2",
  "Street",
  "City",
  "Postal Code",
  "Region",
  "Total Weight",
  "Pallet Unit",
] as const;
export type DachserStage = "INITIAL" | "UPDATE" | "ADDITION";
export type DachserRow = {
  shipmentNumber: string | null;
  salesOrderNumber: string | null;
  deliveryNumber: string | null;
  shipToParty: string | null;
  soldToName1: string | null;
  shipToName2: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  region: string | null;
  totalWeightKg: string | null;
  palletUnit: number | null;
  goodsIssueDate: string | null;
  carrierId: string | null;
};
export type DachserBlocker = { code: string; message: string };
const clean = (value: string | null) =>
  value === null ? null : value.trim().replace(/\r\n|\r/g, "\n");

function canonicalWeight(value: string | null) {
  if (value === null || !/^\d+(?:\.\d{1,3})?$/.test(value)) return value;
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(3, "0")}`;
}
export function exportText(value: string | null) {
  const normalized = clean(value);
  return normalized && /^[=+\-@\t\r\n]/.test(normalized) ? `'${normalized}` : (normalized ?? "");
}
export function canonicalRow(row: DachserRow) {
  return {
    shipmentNumber: clean(row.shipmentNumber),
    salesOrderNumber: clean(row.salesOrderNumber),
    deliveryNumber: clean(row.deliveryNumber),
    shipToParty: clean(row.shipToParty),
    soldToName1: clean(row.soldToName1),
    shipToName2: clean(row.shipToName2),
    street: clean(row.street),
    city: clean(row.city),
    postalCode: clean(row.postalCode),
    region: clean(row.region),
    totalWeightKg: canonicalWeight(row.totalWeightKg),
    palletUnit: row.palletUnit,
    goodsIssueDate: row.goodsIssueDate,
    carrierId: row.carrierId,
  };
}
export function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
export function rowChecksum(row: DachserRow) {
  return checksum(canonicalRow(row));
}

/** Adds positive three-decimal kilogram values without floating-point arithmetic. */
export function sumWeightsKg(values: Array<string | null>) {
  const scaled = values.reduce<string[]>((result, value) => {
    const normalized = canonicalWeight(value);
    if (!normalized || !/^\d+\.\d{3}$/.test(normalized)) return result;
    result.push(normalized.replace(".", "").replace(/^0+(?=\d)/, ""));
    return result;
  }, []);
  if (!scaled.length) return "0.000";
  const width = Math.max(...scaled.map((value) => value.length));
  let carry = 0;
  let total = "";
  for (let index = 0; index < width; index += 1) {
    const digitTotal = scaled.reduce((sum, value) => {
      const digit = value[value.length - 1 - index];
      return sum + (digit ? Number(digit) : 0);
    }, carry);
    total = `${digitTotal % 10}${total}`;
    carry = Math.floor(digitTotal / 10);
  }
  total = `${carry || ""}${total}`.replace(/^0+(?=\d)/, "") || "0";
  const padded = total.padStart(4, "0");
  return `${padded.slice(0, -3)}.${padded.slice(-3)}`;
}
export function datasetChecksum(input: {
  carrierId: string;
  goodsIssueDate: string;
  stage: DachserStage;
  baselineReference: string | null;
  rendererVersion: string;
  calculationVersion: string;
  rows: DachserRow[];
}) {
  return checksum({
    carrierId: input.carrierId,
    goodsIssueDate: input.goodsIssueDate,
    stage: input.stage,
    baselineReference: input.baselineReference,
    rendererVersion: input.rendererVersion,
    calculationVersion: input.calculationVersion,
    rowChecksums: input.rows.map(rowChecksum).sort(),
  });
}
export function validateDachserRow(row: DachserRow): DachserBlocker[] {
  const blockers: DachserBlocker[] = [];
  if (!row.deliveryNumber)
    blockers.push({ code: "MISSING_DELIVERY", message: "Delivery Number is required." });
  if (!clean(row.salesOrderNumber))
    blockers.push({ code: "MISSING_SALES_ORDER", message: "Sales Order Number is required." });
  if (!row.carrierId) blockers.push({ code: "MISSING_CARRIER", message: "Carrier is required." });
  if (!row.goodsIssueDate)
    blockers.push({ code: "MISSING_GOODS_ISSUE_DATE", message: "Goods Issue date is required." });
  if (
    !row.totalWeightKg ||
    !/^\d+(?:\.\d{1,3})?$/.test(row.totalWeightKg) ||
    calculatePlannedPalletUnit(row.totalWeightKg) === null
  )
    blockers.push({
      code: "INVALID_GROSS_WEIGHT",
      message: "A valid positive SAP gross weight is required.",
    });
  if (!Number.isInteger(row.palletUnit) || !row.palletUnit || row.palletUnit < 1)
    blockers.push({
      code: "INVALID_PALLET_UNIT",
      message: "A valid planned pallet count is required.",
    });
  for (const [code, value] of [
    ["MISSING_SHIP_TO", row.shipToParty],
    ["MISSING_SOLD_TO_NAME", row.soldToName1],
  ] as Array<[string, string | null]>)
    if (!clean(value))
      blockers.push({ code, message: "Required Dachser destination data is missing." });
  return blockers;
}
export function filename(date: string, stage: DachserStage, sequence: number) {
  const [year, month, day] = date.split("-");
  const formatted = `${day}.${month}.${year}`;
  return stage === "INITIAL"
    ? `CSV file for ${formatted}.xlsx`
    : `CSV file for ${formatted} (${stage === "UPDATE" ? "Update" : "Addition"}) (${sequence}).xlsx`;
}
