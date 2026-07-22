import { describe, expect, it } from "vitest";

import { updateShipmentSearchParams } from "./shipment-url-state";

describe("Shipment workspace URL state", () => {
  it("preserves active filters when the live search changes", () => {
    const result = updateShipmentSearchParams(
      new URLSearchParams("carrierId=carrier-id&status=open"),
      { q: "Dachser", page: "1" }
    );
    expect(result.toString()).toBe("carrierId=carrier-id&status=open&q=Dachser&page=1");
  });

  it("preserves the current query when advanced filters apply", () => {
    const result = updateShipmentSearchParams(new URLSearchParams("q=19411588"), {
      carrierId: "carrier-id",
      page: "1",
    });
    expect(result.toString()).toBe("q=19411588&carrierId=carrier-id&page=1");
  });

  it("removes a cleared search query", () => {
    const result = updateShipmentSearchParams(new URLSearchParams("q=Dachser&status=closed"), {
      q: undefined,
      page: "1",
    });
    expect(result.toString()).toBe("status=closed&page=1");
  });
});
