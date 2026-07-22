import { irelandBusinessDate } from "@/lib/business-date";

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function suggestDeliveryDate(dispatchDate: string, saturdayOvertime = false) {
  const weekday = new Date(`${dispatchDate}T12:00:00.000Z`).getUTCDay();
  if (weekday === 5) return addDays(dispatchDate, saturdayOvertime ? 1 : 3);
  if (weekday === 6) return addDays(dispatchDate, 2);
  if (weekday === 0) return addDays(dispatchDate, 1);
  return addDays(dispatchDate, 1);
}

export function isBusinessDateAfter(left: string, right: string) {
  return left > right;
}

export function currentIrelandBusinessDate() {
  return irelandBusinessDate();
}
