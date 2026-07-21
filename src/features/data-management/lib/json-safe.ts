export type JsonSafeValue =
  string | number | boolean | null | JsonSafeValue[] | { [key: string]: JsonSafeValue };

export class SpreadsheetJsonSerializationError extends Error {}

export function toJsonSafeValue(value: unknown): JsonSafeValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new SpreadsheetJsonSerializationError("Non-finite number");
    return value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new SpreadsheetJsonSerializationError("Invalid date");
    return value.toISOString();
  }
  if (Array.isArray(value))
    return Array.from({ length: value.length }, (_, index) => toJsonSafeValue(value[index]));
  if (typeof value === "object") {
    const constructorName = value.constructor?.name;
    if (constructorName === "Decimal") return value.toString();
    if (constructorName !== "Object")
      throw new SpreadsheetJsonSerializationError("Unsupported spreadsheet cell object");
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        toJsonSafeValue(item),
      ])
    );
  }
  throw new SpreadsheetJsonSerializationError("Unsupported spreadsheet cell value");
}
