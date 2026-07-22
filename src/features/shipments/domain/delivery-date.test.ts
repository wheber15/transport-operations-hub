import { describe, expect, it } from "vitest";

import { suggestDeliveryDate } from "./delivery-date";

describe("Shipment delivery-date planning", () => {
  it.each([
    ["2026-07-20", false, "2026-07-21"],
    ["2026-07-21", false, "2026-07-22"],
    ["2026-07-22", false, "2026-07-23"],
    ["2026-07-23", false, "2026-07-24"],
    ["2026-07-24", false, "2026-07-27"],
    ["2026-07-24", true, "2026-07-25"],
    ["2026-07-25", false, "2026-07-27"],
    ["2026-07-26", false, "2026-07-27"],
  ])("maps dispatch %s with overtime %s to %s", (dispatch, overtime, delivery) => {
    expect(suggestDeliveryDate(dispatch, overtime)).toBe(delivery);
  });
});
