export { formatDateOnly, formatTimestamp } from "@/lib/date-formatting";

export function formatOperationalNumber(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(value);
}

export function formatOperationalWeight(value: string | null) {
  return value === null
    ? "—"
    : `${new Intl.NumberFormat("en-IE", { maximumFractionDigits: 2 }).format(Number(value))} kg`;
}
