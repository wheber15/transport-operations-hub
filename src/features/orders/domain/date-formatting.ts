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

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

export function formatBusinessDate(value: Date | null) {
  return value && isValidDate(value) ? businessDateFormatter.format(value) : "Not available";
}

export function formatAuditTimestamp(value: Date) {
  return isValidDate(value) ? auditTimestampFormatter.format(value) : "Not available";
}
