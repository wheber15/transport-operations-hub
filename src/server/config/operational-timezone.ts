import "server-only";

type CalendarDate = {
  day: number;
  month: number;
  year: number;
};

function getCalendarDateInTimeZone(timeZone: string, value: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])
  );

  return {
    day: values.day,
    month: values.month,
    year: values.year,
  };
}

export function getOperationalTimeZone() {
  const timeZone = process.env.APP_TIME_ZONE;

  if (!timeZone) {
    throw new Error("APP_TIME_ZONE is not configured.");
  }

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format();
  } catch {
    throw new Error("APP_TIME_ZONE is invalid.");
  }

  return timeZone;
}

export function getOperationalDateOnlyRange(now = new Date()) {
  const timeZone = getOperationalTimeZone();
  const { day, month, year } = getCalendarDateInTimeZone(timeZone, now);
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(Date.UTC(year, month - 1, day + 1));

  return { end, start, timeZone };
}

export function getOperationalHour(now = new Date()) {
  const timeZone = getOperationalTimeZone();
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .formatToParts(now)
    .find((part) => part.type === "hour");

  if (!hour) {
    throw new Error("Operational hour could not be resolved.");
  }

  return Number(hour.value);
}
