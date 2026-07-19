import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { importLimits } from "@/features/data-management/domain/constants";

export type ParsedWorkbook = { sheets: { name: string; rows: string[][] }[] };

export function normalizeIdentifier(value: unknown) {
  return String(value ?? "").trim();
}
export function parseSapWeight(value: string): string | null {
  const input = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*kg\s*$/i, "");
  if (!input || /[^0-9.,\s]/.test(input)) return null;
  const compact = input.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,3})?$/.test(compact))
    return compact.replace(/\./g, "").replace(",", ".");
  if (/^\d+(,\d{1,3})?$/.test(compact)) return compact.replace(",", ".");
  if (/^\d+\.\d{1,3}$/.test(compact)) return compact;
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
function cellToString(value: ExcelJS.CellValue) {
  if (value && typeof value === "object" && "formula" in value) return "__FORMULA__";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return normalizeIdentifier(value);
}
function validateRows(rows: string[][]) {
  if (rows.length === 0 || rows.length > importLimits.maxRows + importLimits.maxHeaderRow)
    throw new Error("The workbook has an unsupported row count.");
  if (
    rows.some(
      (row) =>
        row.length > importLimits.maxColumns ||
        row.some((cell) => cell.length > importLimits.maxCellLength)
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
    const rows = parse(bytes, { bom: true, relax_column_count: true, skip_empty_lines: true }).map(
      (row: unknown[]) => row.map(normalizeIdentifier)
    );
    validateRows(rows);
    return { sheets: [{ name: "CSV", rows }] };
  }
  if (!name.endsWith(".xlsx")) throw new Error("Only .xlsx and .csv files are supported.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never, { ignoreNodes: ["extLst"] });
  const sheets = workbook.worksheets
    .map((sheet) => ({
      name: sheet.name,
      rows: sheet
        .getSheetValues()
        .slice(1)
        .map((row) => (Array.isArray(row) ? row.slice(1).map(cellToString) : [])),
    }))
    .filter((sheet) => sheet.rows.some((row) => row.some(Boolean)));
  if (!sheets.length) throw new Error("The workbook does not contain a usable sheet.");
  sheets.forEach((sheet) => validateRows(sheet.rows));
  return { sheets };
}
export function neutralizeCsvCell(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
