import { irelandBusinessTimeZone } from "@/lib/business-date";

export type MovementTimes = {
  driverInAt: Date | null;
  trailerLoadedAt: Date | null;
  driverOutAt: Date | null;
};

export type ShipmentMovementState = "awaiting-driver" | "on-site" | "loaded" | "departed";

export type MovementValidationErrors = Partial<Record<keyof MovementTimes, string>>;

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function dateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: irelandBusinessTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** Converts an Ireland-local datetime-local value to the UTC instant persisted by PostgreSQL. */
export function irelandLocalDateTimeToUtc(value: string): Date | null {
  if (!localDateTimePattern.test(value)) return null;
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(localTimestamp);

  // One correction yields the Europe/Dublin offset; a second handles the DST boundary itself.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = dateParts(candidate);
    const displayedTimestamp = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );
    candidate = new Date(candidate.getTime() + localTimestamp - displayedTimestamp);
  }

  const resolved = dateParts(candidate);
  if (
    Number(resolved.year) !== year ||
    Number(resolved.month) !== month ||
    Number(resolved.day) !== day ||
    Number(resolved.hour) !== hour ||
    Number(resolved.minute) !== minute
  ) {
    return null;
  }
  return candidate;
}

export function toIrelandDateTimeLocal(value: Date) {
  const parts = dateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function getShipmentMovementState(times: MovementTimes): ShipmentMovementState {
  if (times.driverOutAt) return "departed";
  if (times.trailerLoadedAt) return "loaded";
  if (times.driverInAt) return "on-site";
  return "awaiting-driver";
}

export function validateMovementTimes(times: MovementTimes): MovementValidationErrors {
  const errors: MovementValidationErrors = {};
  if (times.trailerLoadedAt && !times.driverInAt) {
    errors.trailerLoadedAt = "Record Driver In before marking the trailer loaded.";
  }
  if (times.driverOutAt && !times.driverInAt) {
    errors.driverOutAt = "Record Driver In before recording Driver Out.";
  }
  if (times.driverOutAt && !times.trailerLoadedAt) {
    errors.driverOutAt = "Mark the trailer loaded before recording Driver Out.";
  }
  if (times.driverInAt && times.trailerLoadedAt && times.driverInAt > times.trailerLoadedAt) {
    errors.trailerLoadedAt = "Trailer Loaded cannot be earlier than Driver In.";
  }
  if (times.trailerLoadedAt && times.driverOutAt && times.trailerLoadedAt > times.driverOutAt) {
    errors.driverOutAt = "Driver Out cannot be earlier than Trailer Loaded.";
  }
  return errors;
}
