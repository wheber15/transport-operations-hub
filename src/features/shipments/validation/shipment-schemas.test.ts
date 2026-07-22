import { describe, expect, it } from "vitest";

import {
  shipmentCloseSchema,
  shipmentCreateSchema,
  shipmentMovementSchema,
  shipmentSearchFiltersSchema,
  shipmentUpdateSchema,
} from "./shipment-schemas";

describe("shipment validation", () => {
  const carrierId = "11111111-1111-4111-8111-111111111111";

  it("requires a trimmed shipment number, dispatch date, and carrier", () => {
    expect(() => shipmentCreateSchema.parse({})).toThrow();
    expect(
      shipmentCreateSchema.parse({
        shipmentNumber: "  AXON-TEST-001  ",
        dispatchDate: "2026-07-21",
        carrierId,
      })
    ).toMatchObject({ shipmentNumber: "AXON-TEST-001" });
  });

  it("accepts explicit confirmation only for empty Shipment closure", () => {
    expect(shipmentCloseSchema.parse({ confirmEmpty: true })).toEqual({ confirmEmpty: true });
    expect(shipmentCloseSchema.parse({})).toEqual({});
    expect(() => shipmentCloseSchema.parse({ confirmEmpty: false })).toThrow();
  });

  it("allows an OPEN Shipment patch without changing unrelated fields", () => {
    expect(shipmentUpdateSchema.parse({ notes: "Updated note" })).toEqual({
      notes: "Updated note",
    });
  });

  it("requires an ordered Driver In, Trailer Loaded, and Driver Out sequence", () => {
    expect(
      shipmentMovementSchema.parse({
        driverInAt: "2026-07-22T09:00",
        trailerLoadedAt: "2026-07-22T10:00",
        driverOutAt: "2026-07-22T11:00",
      })
    ).toBeDefined();
    expect(() =>
      shipmentMovementSchema.parse({
        driverInAt: null,
        trailerLoadedAt: "2026-07-22T10:00",
        driverOutAt: null,
      })
    ).toThrow();
  });

  it("accepts Tomorrow and safely defaults an invalid dispatch date preset", () => {
    expect(shipmentSearchFiltersSchema.parse({ datePreset: "tomorrow" }).datePreset).toBe(
      "tomorrow"
    );
    expect(shipmentSearchFiltersSchema.parse({ datePreset: "not-a-preset" }).datePreset).toBe(
      "all"
    );
  });
});
