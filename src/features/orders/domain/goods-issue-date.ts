import { irelandBusinessDate } from "@/lib/business-date";
export type GoodsIssueDatePreset = "today" | "yesterday" | "thisWeek" | "all" | "custom";

function isoDate(value: Date) {
  return irelandBusinessDate(value);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveGoodsIssueDateScope(
  preset: GoodsIssueDatePreset,
  referenceDate = new Date(),
  custom?: { from?: string; to?: string }
) {
  const today = isoDate(referenceDate);
  if (preset === "all") return {};
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") {
    const yesterday = addDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (preset === "thisWeek") {
    const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const from = addDays(today, mondayOffset);
    return { from, to: addDays(from, 6) };
  }
  return { from: custom?.from, to: custom?.to };
}
