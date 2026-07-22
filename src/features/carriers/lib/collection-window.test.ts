import { describe, expect, it } from "vitest";
import { formatCarrierSelectorLabel, formatCollectionWindow } from "./collection-window";
describe("collection windows", () => {
  it("formats complete, incomplete, and unset windows", () => {
    expect(formatCollectionWindow("07:00", "17:00")).toBe("07:00–17:00");
    expect(formatCollectionWindow("07:00", null)).toBe("From 07:00 · End time not set");
    expect(formatCollectionWindow(null, null)).toBe("Not set");
  });
  it("formats Shipment selector context", () => {
    expect(
      formatCarrierSelectorLabel({
        name: "Dachser",
        carrierNumber: "401210",
        collectionStartTime: "07:00",
        collectionEndTime: "17:00",
        dailyTrailerLimit: 30,
      })
    ).toBe("Dachser — 401210 · Collection 07:00–17:00 · Limit 30");
  });
});
