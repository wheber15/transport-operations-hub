import { describe, expect, it } from "vitest";

import {
  getShipmentMovementState,
  irelandLocalDateTimeToUtc,
  toIrelandDateTimeLocal,
  validateMovementTimes,
} from "./movement";

const driverIn = new Date("2026-07-22T08:00:00.000Z");
const loaded = new Date("2026-07-22T09:00:00.000Z");
const driverOut = new Date("2026-07-22T10:00:00.000Z");

describe("Shipment movement sequence", () => {
  it("accepts empty, Driver In only, and an ordered sequence", () => {
    expect(
      validateMovementTimes({ driverInAt: null, trailerLoadedAt: null, driverOutAt: null })
    ).toEqual({});
    expect(
      validateMovementTimes({ driverInAt: driverIn, trailerLoadedAt: null, driverOutAt: null })
    ).toEqual({});
    expect(
      validateMovementTimes({
        driverInAt: driverIn,
        trailerLoadedAt: loaded,
        driverOutAt: driverOut,
      })
    ).toEqual({});
  });

  it("rejects missing prerequisites and out-of-order corrections", () => {
    expect(
      validateMovementTimes({ driverInAt: null, trailerLoadedAt: loaded, driverOutAt: null })
    ).toHaveProperty("trailerLoadedAt");
    expect(
      validateMovementTimes({ driverInAt: null, trailerLoadedAt: null, driverOutAt: driverOut })
    ).toHaveProperty("driverOutAt");
    expect(
      validateMovementTimes({ driverInAt: driverIn, trailerLoadedAt: null, driverOutAt: driverOut })
    ).toHaveProperty("driverOutAt");
    expect(
      validateMovementTimes({
        driverInAt: loaded,
        trailerLoadedAt: driverIn,
        driverOutAt: driverOut,
      })
    ).toHaveProperty("trailerLoadedAt");
  });

  it("allows clearing dependent times together and reports the operational state", () => {
    expect(
      validateMovementTimes({ driverInAt: driverIn, trailerLoadedAt: null, driverOutAt: null })
    ).toEqual({});
    expect(
      getShipmentMovementState({ driverInAt: null, trailerLoadedAt: null, driverOutAt: null })
    ).toBe("awaiting-driver");
    expect(
      getShipmentMovementState({ driverInAt: driverIn, trailerLoadedAt: null, driverOutAt: null })
    ).toBe("on-site");
    expect(
      getShipmentMovementState({ driverInAt: driverIn, trailerLoadedAt: loaded, driverOutAt: null })
    ).toBe("loaded");
    expect(
      getShipmentMovementState({
        driverInAt: driverIn,
        trailerLoadedAt: loaded,
        driverOutAt: driverOut,
      })
    ).toBe("departed");
  });

  it("round-trips Ireland-local inputs without a displayed time shift", () => {
    const local = "2026-07-22T09:45";
    const timestamp = irelandLocalDateTimeToUtc(local);
    expect(timestamp).not.toBeNull();
    expect(toIrelandDateTimeLocal(timestamp as Date)).toBe(local);
  });
});
