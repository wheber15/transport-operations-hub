import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { canManageDataImports } from "@/features/auth/domain/roles";
import { importFieldAliases, importLimits } from "@/features/data-management/domain/constants";
import {
  formatSapWeight,
  getImportClassificationLabel,
} from "@/features/data-management/domain/preview";
import {
  parseBusinessDate,
  parseImportFile,
  parseSapWeight,
} from "@/features/data-management/lib/parsing";
import * as repository from "@/features/data-management/infrastructure/data-import-repository";
import { correlateSapOrderBook } from "@/features/sap-order-book/domain/sap-order-book";
import {
  importTypeSchema,
  mappingSchema,
  previewRowsQuerySchema,
} from "@/features/data-management/validation/data-import-schemas";

export class DataImportForbiddenError extends Error {}
type Actor = { id: string; role: string | null };
const allowedFields = {
  deliveryReference: [
    "deliveryNumber",
    "orderNumber",
    "customerName",
    "goodsIssueDate",
    "shipToNumber",
    "routeCode",
    "grossWeightKg",
    "shipmentNumber",
  ],
  operationalSchedule: [
    "deliveryNumber",
    "orderNumber",
    "customerName",
    "scheduledDispatchDate",
    "scheduleSource",
    "sourceReference",
  ],
  sapOrderBook: [],
} as const;
const previewFields = [
  "deliveryNumber",
  "customerName",
  "orderNumber",
  "goodsIssueDate",
  "shipToNumber",
  "routeCode",
  "grossWeightKg",
  "shipmentNumber",
  "scheduledDispatchDate",
  "scheduleSource",
  "sourceReference",
  "shippingPoint",
] as const;
function requireRole(actor: Actor) {
  if (!canManageDataImports(actor.role)) throw new DataImportForbiddenError();
}
function requireMutable(batch: { status: string }) {
  if (["committed", "failed", "expired"].includes(batch.status))
    throw new Error("This import can no longer be changed.");
}
function safeName(name: string) {
  return name.replace(/[\\/\0]/g, "_").slice(0, 255);
}
function sheetSummary(rows: { sheetName: string; mappedValues: unknown }[]) {
  return [...new Set(rows.map((row) => row.sheetName))].map((name) => {
    const sheetRows = rows.filter((row) => row.sheetName === name);
    return {
      name,
      rowCount: sheetRows.length,
      columnCount: Math.max(
        0,
        ...sheetRows.map(
          (row) => ((row.mappedValues as { values?: string[] })?.values ?? []).length
        )
      ),
    };
  });
}
function valuesFromJson(value: unknown) {
  const candidate = value as { values?: unknown[] } | null;
  return Array.isArray(candidate?.values) ? candidate.values.map((cell) => String(cell ?? "")) : [];
}
function recordFromJson(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string | null>)
    : {};
}
function visibleCell(value: string) {
  return value === "__FORMULA__" ? "Formula (unsupported)" : value;
}
export async function uploadImport(actor: Actor, importTypeInput: unknown, file: File) {
  requireRole(actor);
  const importType = importTypeSchema.parse(importTypeInput);
  const workbook = await parseImportFile(file);
  if (importType === "sapOrderBook") {
    const detectedSheets = workbook.sheets.flatMap((sheet) => {
      try {
        return [
          {
            sheet,
            result: correlateSapOrderBook(sheet.rows.map((row) => row.map((cell) => cell ?? "")), sheet.numericCells),
          },
        ];
      } catch {
        return [];
      }
    });
    if (!detectedSheets.length) throw new Error("HEADER_NOT_FOUND");
    const matches = detectedSheets.filter((match) => match.result.records.length > 0);
    if (!matches.length) throw new Error("NO_PROCESSED_ROWS");
    if (matches.length > 1) throw new Error("CONFLICTING_DETAIL_DATA");
    const { sheet, result } = matches[0];
    const [existing, orders] = await Promise.all([
      repository.getActiveDeliveryRecords(result.records.map((record) => record.deliveryNumber)),
      repository.getOrderRecords(result.records.map((record) => record.orderNumber)),
    ]);
    const existingByNumber = new Map(
      existing.map((delivery) => [delivery.deliveryNumber, delivery])
    );
    const ordersByNumber = new Map(orders.map((order) => [order.orderNumber, order]));
    return repository.createSapOrderBookBatch({
      actorId: actor.id,
      originalFileName: safeName(file.name),
      sheetName: sheet.name,
      headerRowNumber: result.headerRowNumber,
      rows: result.records.map((record) => {
        const current = existingByNumber.get(record.deliveryNumber);
        const targetOrder = ordersByNumber.get(record.orderNumber);
        const isUnchanged =
          Boolean(current && targetOrder && current.order.orderNumber === record.orderNumber) &&
          ![
            record.goodsIssueDate &&
              targetOrder?.goodsIssueDate?.toISOString().slice(0, 10) !== record.goodsIssueDate,
            record.shipToNumber && targetOrder?.shipToNumber !== record.shipToNumber,
            record.routeCode && targetOrder?.routeCode !== record.routeCode,
            record.grossWeightKg && targetOrder?.grossWeightKg?.toFixed(3) !== record.grossWeightKg,
            record.shippingPoint && targetOrder?.shippingPoint !== record.shippingPoint,
          ].some(Boolean);
        const baseClassification =
          record.classification === "readyToCreate" && !record.customerName
            ? "requiresReview"
            : record.classification === "readyToCreate" && (current?.deletedAt || targetOrder?.deletedAt)
              ? "unavailableRecord"
              : record.classification === "readyToCreate"
                ? current || targetOrder
                  ? isUnchanged
                    ? "unchanged"
                    : "readyToUpdate"
                  : "readyToCreate"
                : record.classification === "missingDetailRow"
                  ? "missingDetailRow"
                  : record.classification === "invalidWeight"
                    ? "invalidWeight"
                    : record.classification === "invalidIdentifier"
                      ? "invalidIdentifier"
                      : record.classification === "duplicateDelivery"
                        ? "duplicateDelivery"
                        : "requiresReview";
        const classification = baseClassification;
        return {
          sourceRowNumber: record.headerRowNumber,
          identifier: record.deliveryNumber,
          classification,
          message:
            classification === "requiresReview" && !record.customerName
              ? "Customer Name is required before this Delivery can be created."
              : classification === "unavailableRecord"
                ? "The Delivery or Originating Order is unavailable."
                : classification === "readyToCreate"
                  ? "Ready to create a Customer, Order, Delivery, and association."
                  : classification === "readyToUpdate"
                    ? "Ready to create or update SAP-owned records; shipment and pallet data will be preserved."
                    : classification === "unchanged"
                      ? "No approved SAP field changes or new associations were detected."
                    : record.message,
          currentValues: current
            ? {
                orderNumber: current.order.orderNumber,
                customerName: current.order.customer.name,
                shipmentNumber: current.shipmentId ? "Assigned" : null,
              }
            : null,
          proposedValues: {
            deliveryNumber: record.deliveryNumber,
            orderNumber: record.orderNumber,
            customerName: record.customerName,
            shipToNumber: record.shipToNumber,
            routeCode: record.routeCode,
            goodsIssueDate: record.goodsIssueDate,
            grossWeightKg: record.grossWeightKg,
            shippingPoint: record.shippingPoint,
            processedSourceRow: record.headerRowNumber,
            matchedDetailSourceRows: record.detailRowNumbers,
            individualDetailWeights: record.detailWeightValues,
            conflicts: record.conflicts,
            proposedAction: classification,
          },
        };
      }),
    });
  }
  if (
    importType === "deliveryReference" &&
    workbook.sheets.some((sheet) => {
      try {
        correlateSapOrderBook(sheet.rows.map((row) => row.map((cell) => cell ?? "")));
        return true;
      } catch {
        return false;
      }
    })
  )
    throw new Error("SAP_ORDER_BOOK_REQUIRED");
  return repository.createImportBatch({
    actorId: actor.id,
    importType,
    originalFileName: safeName(file.name),
    sheets: workbook.sheets,
  });
}
export async function getBatch(actor: Actor, id: string) {
  requireRole(actor);
  const batch = await repository.getImportBatch(id);
  if (!batch) throw new Error("Import batch not found.");
  return { batch, sheets: sheetSummary(batch.rows) };
}
export async function selectSheet(actor: Actor, id: string, sheetName: string) {
  const { batch, sheets } = await getBatch(actor, id);
  requireMutable(batch);
  if (!sheets.some((sheet) => sheet.name === sheetName))
    throw new Error("The selected sheet is not available.");
  await repository.updateBatchConfiguration({
    id,
    actorId: actor.id,
    selectedSheetName: sheetName,
    selectedHeaderRow: null,
    mapping: null,
    status: "uploaded",
  });
  return getBatch(actor, id);
}
export async function selectHeader(actor: Actor, id: string, headerRow: number) {
  const { batch } = await getBatch(actor, id);
  requireMutable(batch);
  if (!batch.selectedSheetName || headerRow > importLimits.maxHeaderRow)
    throw new Error("Select a sheet and a valid header row first.");
  const row = batch.rows.find(
    (item) => item.sheetName === batch.selectedSheetName && item.sourceRowNumber === headerRow
  );
  const values = ((row?.mappedValues as { values?: string[] })?.values ?? []).map((value) =>
    value.trim()
  );
  if (!values.some(Boolean)) throw new Error("The selected header row is empty.");
  await repository.updateBatchConfiguration({
    id,
    actorId: actor.id,
    selectedSheetName: batch.selectedSheetName,
    selectedHeaderRow: headerRow,
    mapping: null,
    status: "uploaded",
  });
  const normalized = values.map((value) => value.toLowerCase());
  return {
    headers: values.map((label, index) => ({
      label,
      index,
      sampleValues: batch.rows
        .filter(
          (item) => item.sheetName === batch.selectedSheetName && item.sourceRowNumber > headerRow
        )
        .slice(0, 3)
        .map((item) => ((item.mappedValues as { values?: string[] })?.values ?? [])[index] ?? ""),
      duplicate: Boolean(label) && normalized.indexOf(normalized[index]) !== index,
    })),
    suggestions: Object.fromEntries(
      Object.entries(importFieldAliases).map(([target, aliases]) => [
        target,
        values.find((value) => (aliases as readonly string[]).includes(value.toLowerCase())) ??
          null,
      ])
    ),
  };
}
export async function saveMapping(actor: Actor, id: string, input: unknown) {
  const { batch } = await getBatch(actor, id);
  requireMutable(batch);
  const parsed = mappingSchema.extend({ importType: importTypeSchema }).parse(input);
  if (parsed.importType === "sapOrderBook")
    throw new Error("SAP Order Book columns are detected automatically.");
  if (
    !batch.selectedSheetName ||
    batch.selectedHeaderRow !== parsed.headerRow ||
    parsed.selectedSheetName !== batch.selectedSheetName ||
    parsed.importType !== batch.importType
  )
    throw new Error("The mapping does not match the selected import state.");
  const allowed = allowedFields[parsed.importType];
  if (Object.keys(parsed.mapping).some((target) => !allowed.includes(target as never)))
    throw new Error("The mapping contains an unsupported target field.");
  const required =
    parsed.importType === "operationalSchedule"
      ? ["deliveryNumber", "scheduledDispatchDate", "scheduleSource"]
      : ["deliveryNumber"];
  if (required.some((field) => !parsed.mapping[field]))
    throw new Error("Required mapping fields are missing.");
  await repository.updateBatchConfiguration({
    id,
    actorId: actor.id,
    selectedSheetName: batch.selectedSheetName,
    selectedHeaderRow: parsed.headerRow,
    mapping: parsed.mapping,
    status: "configured",
  });
  return getBatch(actor, id);
}
export async function previewImport(
  actor: Actor,
  id: string,
  dateControl?: { intendedGoodsIssueDate?: unknown; acknowledgeMismatch?: unknown; reason?: unknown }
) {
  const { batch } = await getBatch(actor, id);
  requireMutable(batch);
  if (batch.importType === "sapOrderBook") {
    const intendedValue =
      typeof dateControl?.intendedGoodsIssueDate === "string"
        ? parseBusinessDate(dateControl.intendedGoodsIssueDate)
        : null;
    if (!intendedValue) throw new Error("Select a valid Intended Goods Issue Date before previewing.");
    const acknowledgeMismatch = dateControl?.acknowledgeMismatch === true;
    const reason = typeof dateControl?.reason === "string" ? dateControl.reason.trim() : "";
    const rows = batch.rows.map((row) => {
      const proposed = recordFromJson(row.proposedValues);
      const sapGoodsIssueDate = proposed.goodsIssueDate;
      const base = { id: row.id, identifier: row.identifier, currentValues: row.currentValues as Prisma.InputJsonValue | null, proposedValues: { ...proposed, intendedGoodsIssueDate: intendedValue, sapGoodsIssueDate } as Prisma.InputJsonValue };
      if (!sapGoodsIssueDate)
        return { ...base, classification: "missingSapDate", message: "SAP Goods Issue Date is missing or invalid and blocks import." };
      if (sapGoodsIssueDate !== intendedValue && (!acknowledgeMismatch || !reason))
        return {
          ...base,
          classification: "dateMismatchRequiresAcknowledgement",
          message: "SAP Goods Issue Date differs from the intended date. Acknowledgement and reason are required.",
        };
      const overrideClassification = {
        readyToCreate: "readyToCreateWithDateOverride",
        readyToUpdate: "readyToUpdateWithDateOverride",
        unchanged: "unchangedWithDateOverride",
      }[row.classification];
      return {
        ...base,
        classification: sapGoodsIssueDate === intendedValue ? row.classification : (overrideClassification ?? row.classification),
        message:
          sapGoodsIssueDate === intendedValue
            ? (row.message ?? "")
            : overrideClassification
              ? `Date override acknowledged: SAP ${sapGoodsIssueDate}; operational ${intendedValue}. Reason: ${reason}`
              : (row.message ?? ""),
      };
    });
    await repository.saveSapOrderBookDatePreview({
      batchId: batch.id,
      actorId: actor.id,
      intendedGoodsIssueDate: new Date(`${intendedValue}T00:00:00.000Z`),
      acknowledgement:
        acknowledgeMismatch && reason ? { at: new Date(), byId: actor.id, reason } : null,
      rows,
    });
    return repository.getImportBatch(batch.id);
  }
  if (!batch.selectedSheetName || !batch.selectedHeaderRow || !batch.mapping)
    throw new Error("Select a sheet, header row, and mapping before previewing.");
  const selectedSheetName = batch.selectedSheetName;
  const selectedHeaderRow = batch.selectedHeaderRow;
  const mapping = batch.mapping as Record<string, string>;
  const header = batch.rows.find(
    (row) => row.sheetName === selectedSheetName && row.sourceRowNumber === selectedHeaderRow
  );
  const headers = (header?.mappedValues as { values?: string[] })?.values ?? [];
  const mappedRows = batch.rows
    .filter((row) => row.sheetName === selectedSheetName && row.sourceRowNumber > selectedHeaderRow)
    .map((row) => ({
      row,
      proposed: Object.fromEntries(
        Object.entries(mapping).map(([target, source]) => [
          target,
          ((row.mappedValues as { values?: string[] })?.values ?? [])[
            headers.indexOf(source)
          ]?.trim() ?? "",
        ])
      ),
    }));
  const deliveries = await repository.getActiveDeliveryRecords(
    mappedRows.map((item) => item.proposed.deliveryNumber).filter(Boolean)
  );
  const deliveryMap = new Map(deliveries.map((delivery) => [delivery.deliveryNumber, delivery]));
  const duplicateKeys = new Set(
    mappedRows
      .map(
        ({ proposed }) =>
          `${proposed.deliveryNumber}|${batch.importType === "operationalSchedule" ? proposed.scheduleSource?.trim().toLowerCase() : ""}`
      )
      .filter((key, index, values) => values.indexOf(key) !== index)
  );
  const results = mappedRows.map(({ row, proposed }) => {
    const number = proposed.deliveryNumber;
    const record = deliveryMap.get(number);
    let classification = "validUpdate";
    let message = "Ready to update.";
    if (!number)
      [classification, message] = ["missingRequiredValue", "Delivery Number is required."];
    else if (Object.values(proposed).includes("__FORMULA__"))
      [classification, message] = ["unsupportedField", "Formula cells cannot be imported."];
    else if (
      duplicateKeys.has(
        `${number}|${batch.importType === "operationalSchedule" ? proposed.scheduleSource?.trim().toLowerCase() : ""}`
      )
    )
      [classification, message] = ["duplicateRow", "Duplicate spreadsheet row."];
    else if (proposed.goodsIssueDate && !parseBusinessDate(proposed.goodsIssueDate))
      [classification, message] = ["invalidDate", "Goods Issue Date is invalid."];
    else if (proposed.grossWeightKg && !parseSapWeight(proposed.grossWeightKg))
      [classification, message] = ["invalidWeight", "Gross Weight is invalid."];
    else if (
      batch.importType === "operationalSchedule" &&
      (!proposed.scheduledDispatchDate ||
        !parseBusinessDate(proposed.scheduledDispatchDate) ||
        !proposed.scheduleSource)
    )
      [classification, message] = [
        "missingRequiredValue",
        "Schedule Date and Source are required.",
      ];
    else if (!record)
      [classification, message] = ["relatedRecordNotFound", "No matching delivery was found."];
    else if (record.deletedAt || record.order.deletedAt)
      [classification, message] = [
        "unavailableRecord",
        "The delivery or related order is unavailable.",
      ];
    else if (proposed.orderNumber && proposed.orderNumber !== record.order.orderNumber)
      [classification, message] = ["conflict", "Order Number does not match the delivery."];
    else if (
      batch.importType === "deliveryReference" &&
      ![
        proposed.goodsIssueDate,
        proposed.shipToNumber,
        proposed.routeCode,
        proposed.grossWeightKg,
      ].some(Boolean)
    )
      [classification, message] = ["unchanged", "No supported update values were provided."];
    return {
      id: row.id,
      identifier: number || null,
      classification,
      message,
      currentValues: record
        ? {
            orderNumber: record.order.orderNumber,
            customerName: record.order.customer.name,
            goodsIssueDate: record.order.goodsIssueDate?.toISOString().slice(0, 10) ?? null,
          }
        : null,
      proposedValues: proposed,
    };
  });
  await repository.savePreview({
    batchId: id,
    actorId: actor.id,
    rows: results as {
      id: string;
      identifier: string | null;
      classification: string;
      message: string;
      currentValues: Prisma.InputJsonValue | null;
      proposedValues: Prisma.InputJsonValue | null;
    }[],
  });
  return repository.getImportBatch(id);
}
export async function getImportPreviewRows(actor: Actor, id: string, queryInput: unknown) {
  requireRole(actor);
  const query = previewRowsQuerySchema.parse(queryInput);
  const batch = await repository.getImportBatchPreviewContext(id);
  if (!batch) throw new Error("Import batch not found.");
  if (!batch.selectedSheetName || !batch.selectedHeaderRow)
    throw new Error("Select a sheet and header row before viewing rows.");
  if (query.view === "preview" && !batch.mapping)
    throw new Error("Confirm the column mapping before viewing the import preview.");
  const header =
    batch.importType === "sapOrderBook"
      ? null
      : await repository.getImportHeaderRow(
          batch.id,
          batch.selectedSheetName,
          batch.selectedHeaderRow
        );
  const columns = valuesFromJson(header?.mappedValues).map((label, index) => ({
    index,
    label: label || `Column ${index + 1}`,
  }));
  const result = await repository.getPreviewRows({
    batchId: batch.id,
    sheetName: batch.selectedSheetName,
    headerRow: batch.selectedHeaderRow,
    page: query.page,
    pageSize: query.pageSize,
    ...(query.view === "preview"
      ? { classification: query.classification, query: query.query }
      : {}),
  });
  const classificationCounts = Object.fromEntries(
    result.classifications.map((entry) => [
      entry.classification,
      typeof entry._count === "object" && entry._count ? (entry._count._all ?? 0) : 0,
    ])
  );
  if (query.view === "raw") {
    return {
      view: "raw" as const,
      columns,
      rows: result.rows.map((row) => ({
        sourceRowNumber: row.sourceRowNumber,
        values: valuesFromJson(row.mappedValues).map(visibleCell),
      })),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total },
    };
  }
  const mapping = batch.mapping as Record<string, string>;
  const mappedFields = new Set(Object.keys(mapping));
  return {
    view: "preview" as const,
    importType: batch.importType,
    mappedFields: [...mappedFields],
    rows: result.rows.map((row) => {
      const proposed = recordFromJson(row.proposedValues);
      const current = recordFromJson(row.currentValues);
      const displayValues = Object.fromEntries(
        previewFields
          .filter((field) => mappedFields.has(field) || field === "deliveryNumber")
          .map((field) => [field, proposed[field] ?? current[field] ?? null])
      ) as Record<string, string | null>;
      const rawWeight = proposed.grossWeightKg ?? null;
      const parsedWeight = rawWeight ? parseSapWeight(rawWeight) : null;
      return {
        sourceRowNumber: row.sourceRowNumber,
        identifier: row.identifier,
        displayValues: {
          ...displayValues,
          grossWeightRaw: rawWeight,
          grossWeightKg: parsedWeight ? formatSapWeight(parsedWeight) : rawWeight,
        },
        currentValues: Object.fromEntries(
          previewFields
            .filter((field) => current[field] !== undefined)
            .map((field) => [field, current[field]])
        ),
        proposedValues: Object.fromEntries(
          previewFields
            .filter((field) => proposed[field] !== undefined)
            .map((field) => [field, proposed[field]])
        ),
        classification: row.classification,
        classificationLabel: getImportClassificationLabel(row.classification),
        message: row.message,
        issues: ["validUpdate", "unchanged", "readyToCreate", "readyToUpdate", "readyToCreateWithDateOverride", "readyToUpdateWithDateOverride", "unchangedWithDateOverride"].includes(
          row.classification
        )
          ? []
          : [row.message],
      };
    }),
    counts: classificationCounts,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  };
}
export async function commitImport(actor: Actor, id: string) {
  requireRole(actor);
  return repository.commitBatch(id, actor.id);
}
export async function listImportBatches(actor: Actor) {
  requireRole(actor);
  return repository.listImportBatches();
}
export { repository as dataImportRepository, importLimits };
