import { irelandBusinessDate } from "@/lib/business-date";

export type DispatchDatePreset = "today" | "yesterday" | "thisWeek" | "all" | "custom";

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveDispatchDateScope(
  preset: DispatchDatePreset,
  referenceDate = new Date(),
  custom?: { from?: string; to?: string }
) {
  const today = irelandBusinessDate(referenceDate);
  if (preset === "all") return {};
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") return { from: addDays(today, -1), to: addDays(today, -1) };
  if (preset === "thisWeek") {
    const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const from = addDays(today, mondayOffset);
    return { from, to: addDays(from, 6) };
  }
  return { from: custom?.from, to: custom?.to };
}
