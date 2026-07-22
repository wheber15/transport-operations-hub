export const irelandBusinessTimeZone = "Europe/Dublin";

function part(value: Date, type: Intl.DateTimeFormatPartTypes) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: irelandBusinessTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(value)
    .find((item) => item.type === type)?.value;
}

export function irelandBusinessDate(value = new Date()) {
  const year = part(value, "year");
  const month = part(value, "month");
  const day = part(value, "day");
  return `${year}-${month}-${day}`;
}

export function timestampMatchesIrelandBusinessDate(value: Date, calendarDate: string | null) {
  return calendarDate !== null && irelandBusinessDate(value) === calendarDate;
}

export function formatIrelandDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: irelandBusinessTimeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
