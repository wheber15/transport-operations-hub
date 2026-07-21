import { describe, expect, it } from "vitest";

import {
  shipmentCloseSchema,
  shipmentCreateSchema,
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
});
