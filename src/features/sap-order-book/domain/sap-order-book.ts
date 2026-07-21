import { parseBusinessDate, parseSapWeight } from "@/features/data-management/lib/parsing";

export type SapOrderBookRecord = {
  deliveryNumber: string;
  orderNumber: string;
  customerName: string | null;
  shipToNumber: string | null;
  routeCode: string | null;
  goodsIssueDate: string | null;
  grossWeightKg: string | null;
  shippingPoint: string | null;
  headerRowNumber: number;
  detailRowNumbers: number[];
  detailWeightValues: string[];
  classification:
    | "readyToCreate"
    | "missingDetailRow"
    | "requiresReview"
    | "duplicateDelivery"
    | "invalidIdentifier"
    | "invalidWeight";
  message: string;
  conflicts: Record<string, string[]>;
};

type HeaderMap = Record<string, number>;
type SourceRow = { sourceRowNumber: number; values: string[] };

const aliases: Record<string, string[]> = {
  salesDocument: ["sales document", "sales doc", "delivery number"],
  originatingDocument: ["originating document", "origindoc", "origin doc", "sales order"],
  routeCode: ["route"],
  shippingPoint: ["shipping point receiving pt", "shipping point", "receiving pt"],
  goodsIssueDate: ["goods issue date", "goods issue", "gi date"],
  shipToNumber: ["ship to party", "ship to", "shipto party"],
  grossWeight: ["open gross weight", "gross weight"],
  weightUnit: ["weight unit"],
  customerName: ["name 1", "customer name"],
};

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeValue(value: string | undefined) {
  return value?.trim() ?? "";
}

export function normalizeSapIdentifier(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+\.0+$/.test(trimmed)) return trimmed.slice(0, trimmed.indexOf("."));
  if (/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(trimmed)) {
    const numeric = Number(trimmed);
    return Number.isSafeInteger(numeric) ? numeric.toFixed(0) : null;
  }
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

function findHeader(rows: string[][]) {
  for (let index = 0; index < Math.min(rows.length, 20); index++) {
    const values = rows[index].map(normalizeHeader);
    const map = Object.fromEntries(
      Object.entries(aliases).flatMap(([field, names]) => {
        const column = values.findIndex((value) => names.includes(value));
        return column >= 0 ? [[field, column]] : [];
      })
    ) as HeaderMap;
    if (map.salesDocument !== undefined && map.originatingDocument !== undefined)
      return { index, map };
  }
  return null;
}

function valuesFor(rows: SourceRow[], column: number | undefined) {
  return [...new Set(rows.map((row) => normalizeValue(row.values[column ?? -1])).filter(Boolean))];
}

function oneValue(values: string[]) {
  return values.length === 1 ? values[0] : null;
}

function sumWeights(weights: string[]) {
  const scaled = weights.map((weight) => {
    const [whole, decimal = ""] = weight.split(".");
    return `${whole}${decimal.padEnd(3, "0").slice(0, 3)}`.replace(/^0+(?=\d)/, "");
  });
  let carry = 0;
  let total = "";
  const width = Math.max(...scaled.map((value) => value.length));
  for (let index = 0; index < width; index++) {
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

function parseOrderBookDate(value: string) {
  const parsed = parseBusinessDate(value);
  if (parsed) return parsed;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  if (Number(month) > 12 || Number(day) > 31) return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
    ? date.toISOString().slice(0, 10)
    : null;
}

export function correlateSapOrderBook(rows: string[][]) {
  const detected = findHeader(rows);
  if (!detected) throw new Error("HEADER_NOT_FOUND");
  const sourceRows = rows
    .slice(detected.index + 1)
    .map((values, index) => ({ sourceRowNumber: detected.index + index + 2, values }))
    .filter((row) => row.values.some((value) => normalizeValue(value)));
  const value = (row: SourceRow, field: keyof typeof aliases) =>
    normalizeValue(row.values[detected.map[field] ?? -1]);
  const processed = sourceRows.filter((row) =>
    Boolean(
      normalizeSapIdentifier(value(row, "salesDocument")) &&
      normalizeSapIdentifier(value(row, "originatingDocument"))
    )
  );
  const detailsByOrder = new Map<string, SourceRow[]>();
  for (const row of sourceRows) {
    const order = normalizeSapIdentifier(value(row, "originatingDocument"));
    if (order && !normalizeValue(value(row, "salesDocument"))) {
      detailsByOrder.set(order, [...(detailsByOrder.get(order) ?? []), row]);
    }
  }
  const deliveriesPerOrder = new Map<string, Set<string>>();
  for (const row of processed) {
    const order = normalizeSapIdentifier(value(row, "originatingDocument"))!;
    const delivery = normalizeSapIdentifier(value(row, "salesDocument"))!;
    deliveriesPerOrder.set(order, new Set([...(deliveriesPerOrder.get(order) ?? []), delivery]));
  }
  const records: SapOrderBookRecord[] = [];
  const seenDeliveries = new Set<string>();
  for (const header of processed) {
    const deliveryNumber = normalizeSapIdentifier(value(header, "salesDocument"));
    const orderNumber = normalizeSapIdentifier(value(header, "originatingDocument"));
    if (!deliveryNumber || !orderNumber) continue;
    const detailRows = detailsByOrder.get(orderNumber) ?? [];
    const duplicateDelivery = seenDeliveries.has(deliveryNumber);
    seenDeliveries.add(deliveryNumber);
    const customerNames = valuesFor(detailRows, detected.map.customerName);
    const shipToNumbers = valuesFor(detailRows, detected.map.shipToNumber);
    const routeCodes = valuesFor(detailRows, detected.map.routeCode);
    const goodsIssueDates = valuesFor(detailRows, detected.map.goodsIssueDate)
      .map(parseOrderBookDate)
      .filter((date): date is string => Boolean(date));
    const rawWeights = detailRows.map((row) => value(row, "grossWeight"));
    const weights = detailRows
      .filter((row) => !value(row, "weightUnit") || value(row, "weightUnit").toUpperCase() === "KG")
      .map((row) => parseSapWeight(value(row, "grossWeight")))
      .filter((weight): weight is string => Boolean(weight));
    const conflicts = Object.fromEntries(
      Object.entries({
        customerName: customerNames,
        shipToNumber: shipToNumbers,
        routeCode: routeCodes,
        goodsIssueDate: goodsIssueDates,
      }).filter(([, values]) => values.length > 1)
    );
    const ambiguousOrder = (deliveriesPerOrder.get(orderNumber)?.size ?? 0) > 1;
    const invalidWeight = rawWeights.some((weight) => weight && !parseSapWeight(weight));
    const classification = !detailRows.length
      ? "missingDetailRow"
      : invalidWeight
        ? "invalidWeight"
        : duplicateDelivery || ambiguousOrder || Object.keys(conflicts).length
          ? "requiresReview"
          : "readyToCreate";
    const message = !detailRows.length
      ? "No matching detail row was found for this Sales Order."
      : invalidWeight
        ? "One or more detail-row weights are invalid."
        : duplicateDelivery
          ? "The workbook maps this Delivery Number more than once."
          : ambiguousOrder
            ? "This Sales Order maps to multiple Delivery Numbers; detail weight attribution requires review."
            : Object.keys(conflicts).length
              ? "Conflicting detail values require review."
              : "Ready to create.";
    records.push({
      deliveryNumber,
      orderNumber,
      customerName: oneValue(customerNames),
      shipToNumber: oneValue(shipToNumbers),
      routeCode: oneValue(routeCodes),
      goodsIssueDate: oneValue(goodsIssueDates),
      grossWeightKg: weights.length ? sumWeights(weights) : null,
      shippingPoint:
        oneValue(valuesFor(detailRows, detected.map.shippingPoint)) ||
        value(header, "shippingPoint") ||
        null,
      headerRowNumber: header.sourceRowNumber,
      detailRowNumbers: detailRows.map((row) => row.sourceRowNumber),
      detailWeightValues: weights,
      classification,
      message,
      conflicts,
    });
  }
  const normalizedRecords = new Map<string, SapOrderBookRecord>();
  for (const record of records) {
    const existing = normalizedRecords.get(record.deliveryNumber);
    if (!existing) {
      normalizedRecords.set(record.deliveryNumber, record);
      continue;
    }
    normalizedRecords.set(record.deliveryNumber, {
      ...existing,
      classification: "duplicateDelivery",
      message: "The workbook contains this Delivery Number more than once.",
      conflicts: {
        ...existing.conflicts,
        duplicateDelivery: [String(existing.headerRowNumber), String(record.headerRowNumber)],
      },
    });
  }
  return {
    headerRowNumber: detected.index + 1,
    processedRowsDetected: processed.length,
    unprocessedDetailOrders: [...detailsByOrder.keys()].filter(
      (order) => !deliveriesPerOrder.has(order)
    ).length,
    records: [...normalizedRecords.values()],
  };
}
