const businessDateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const auditTimestampFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function isValidDate(value: Date | null): value is Date {
  return value !== null && !Number.isNaN(value.getTime());
}

export function formatDateOnly(value: Date | null) {
  return isValidDate(value) ? businessDateFormatter.format(value) : "Not available";
}

export function formatTimestamp(value: Date) {
  return auditTimestampFormatter.format(value);
}
