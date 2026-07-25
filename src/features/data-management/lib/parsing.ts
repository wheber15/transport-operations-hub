import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { importLimits } from "@/features/data-management/domain/constants";
import { toJsonSafeValue } from "@/features/data-management/lib/json-safe";

export type SpreadsheetCell = string | null;
export type ParsedWorkbook = {
  sheets: { name: string; rows: SpreadsheetCell[][]; numericCells?: boolean[][] }[];
};

const xlsxMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);
const csvMimeTypes = new Set(["text/csv", "application/csv", "text/plain"]);

export function normalizeIdentifier(value: unknown) {
  return String(value ?? "").trim();
}
export function parseSapWeight(value: string, representation: "numeric" | "text" = "text"): string | null {
  const positive = (parsed: string) => (/^0(?:\.0+)?$/.test(parsed) ? null : parsed);
  const input = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*kg\s*$/i, "");
  if (!input || /[^0-9.,\s]/.test(input)) return null;
  const compact = input.replace(/\s/g, "");
  if (representation === "numeric" && /^\d+$/.test(compact)) {
    const padded = compact.padStart(4, "0");
    return positive(`${padded.slice(0, -3)}.${padded.slice(-3)}`);
  }
  if (representation === "numeric" && /^\d+\.\d{1,3}$/.test(compact)) return positive(compact);
  if (/^\d{1,3}(\.\d{3})+,\d{1,3}$/.test(compact))
    return positive(compact.replace(/\./g, "").replace(",", "."));
  if (/^\d+,\d{1,3}$/.test(compact)) return positive(compact.replace(",", "."));
  if (/^\d+\.\d{1,3}$/.test(compact)) return positive(compact);
  return null;
}
export function parseBusinessDate(value: string): string | null {
  const input = value.trim();
  if (/^\d{1,5}$/.test(input)) {
    const serial = Number(input);
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const parts =
    input.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/) ?? input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const [year, month, day] =
    parts[1].length === 4
      ? [Number(parts[1]), Number(parts[2]), Number(parts[3])]
      : [Number(parts[3]), Number(parts[2]), Number(parts[1])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}
function cellToString(value: ExcelJS.CellValue | undefined): SpreadsheetCell {
  if (value === undefined || value === null) return null;
  if (value && typeof value === "object" && "formula" in value) return "__FORMULA__";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const safe = toJsonSafeValue(value);
  if (safe === null) return null;
  if (typeof safe === "string" || typeof safe === "number" || typeof safe === "boolean")
    return normalizeIdentifier(safe);
  throw new Error("The spreadsheet contained an unsupported cell value.");
}
function isEmptyRow(row: SpreadsheetCell[]) {
  return row.every((cell) => cell === null || cell.trim() === "");
}
function trimTrailingEmptyRows(rows: SpreadsheetCell[][]) {
  let lastMeaningful = rows.length - 1;
  while (lastMeaningful >= 0 && isEmptyRow(rows[lastMeaningful])) lastMeaningful--;
  return rows.slice(0, lastMeaningful + 1);
}
function validateRows(rows: SpreadsheetCell[][]) {
  if (rows.length === 0 || rows.length > importLimits.maxRows + importLimits.maxHeaderRow)
    throw new Error("The workbook has an unsupported row count.");
  if (
    rows.some(
      (row) =>
        row.length > importLimits.maxColumns ||
        row.some((cell) => cell !== null && cell.length > importLimits.maxCellLength)
    )
  )
    throw new Error("The workbook exceeds the supported column or cell limits.");
}
export async function parseImportFile(file: File): Promise<ParsedWorkbook> {
  if (file.size === 0 || file.size > importLimits.maxFileBytes)
    throw new Error("The file is empty or exceeds the 10 MB limit.");
  const name = file.name.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv")) {
    if (file.type && !csvMimeTypes.has(file.type))
      throw new Error("The CSV file has an unsupported content type.");
    const rows = parse(bytes, { bom: true, relax_column_count: true, skip_empty_lines: true }).map(
      (row: unknown[]) =>
        Array.from({ length: row.length }, (_, index) => normalizeIdentifier(row[index]))
    );
    validateRows(rows);
    return { sheets: [{ name: "CSV", rows, numericCells: rows.map((row) => row.map(() => false)) }] };
  }
  if (!name.endsWith(".xlsx")) throw new Error("Only .xlsx and .csv files are supported.");
  if (file.type && !xlsxMimeTypes.has(file.type))
    throw new Error("The XLSX file has an unsupported content type.");
  if (!bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
    throw new Error("The XLSX file is malformed or is not an Office Open XML workbook.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never, { ignoreNodes: ["extLst"] });
  const sheets = workbook.worksheets
    .map((sheet) => {
      const parsedRows = Array.from({ length: sheet.rowCount }, (_, rowIndex) => {
          const values = sheet.getRow(rowIndex + 1).values;
          const width = Array.isArray(values) ? Math.max(0, values.length - 1) : 0;
          return Array.from({ length: width }, (_, columnIndex) =>
            cellToString(Array.isArray(values) ? values[columnIndex + 1] : undefined)
          );
        });
      const numericCells = Array.from({ length: sheet.rowCount }, (_, rowIndex) => {
        const values = sheet.getRow(rowIndex + 1).values;
        const width = Array.isArray(values) ? Math.max(0, values.length - 1) : 0;
        return Array.from({ length: width }, (_, columnIndex) =>
          typeof (Array.isArray(values) ? values[columnIndex + 1] : undefined) === "number"
        );
      });
      const rows = trimTrailingEmptyRows(parsedRows);
      return { name: sheet.name, rows, numericCells: numericCells.slice(0, rows.length) };
    })
    .filter((sheet) => sheet.rows.some((row) => !isEmptyRow(row)));
  if (!sheets.length) throw new Error("The workbook does not contain a usable sheet.");
  sheets.forEach((sheet) => validateRows(sheet.rows));
  return { sheets };
}
export function neutralizeCsvCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
