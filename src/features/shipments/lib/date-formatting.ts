export { formatDateOnly, formatTimestamp } from "@/lib/date-formatting";

export function formatOperationalNumber(value: number | null) {
  return value === null ? "Not available" : String(value);
}

export function formatOperationalWeight(value: string | null) {
  return value ?? "Not available";
}
