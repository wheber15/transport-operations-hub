import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { canManageDataImports } from "@/features/auth/domain/roles";
import { importFieldAliases, importLimits } from "@/features/data-management/domain/constants";
import {
  parseBusinessDate,
  parseImportFile,
  parseSapWeight,
} from "@/features/data-management/lib/parsing";
import * as repository from "@/features/data-management/infrastructure/data-import-repository";
import {
  importTypeSchema,
  mappingSchema,
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
} as const;
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
export async function uploadImport(actor: Actor, importTypeInput: unknown, file: File) {
  requireRole(actor);
  const importType = importTypeSchema.parse(importTypeInput);
  const workbook = await parseImportFile(file);
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
export async function previewImport(actor: Actor, id: string) {
  const { batch } = await getBatch(actor, id);
  requireMutable(batch);
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
export async function commitImport(actor: Actor, id: string) {
  requireRole(actor);
  return repository.commitBatch(id, actor.id);
}
export async function listImportBatches(actor: Actor) {
  requireRole(actor);
  return repository.listImportBatches();
}
export { repository as dataImportRepository, importLimits };
