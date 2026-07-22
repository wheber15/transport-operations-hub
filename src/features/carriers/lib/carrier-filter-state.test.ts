import { describe, expect, it } from "vitest";

import {
  normalizeCarrierFilterState,
  readCarrierFilterParams,
  updateCarrierFilterSearchParams,
} from "./carrier-filter-state";

describe("Carrier filter URL state", () => {
  it("defaults missing and invalid status values to active", () => {
    expect(normalizeCarrierFilterState(undefined, true)).toBe("active");
    expect(normalizeCarrierFilterState("unknown", true)).toBe("active");
  });

  it("does not allow non-managers to select inactive records through the URL", () => {
    expect(readCarrierFilterParams({ q: "Dachser", status: "inactive" }, false)).toEqual({
      query: "Dachser",
      state: "active",
    });
  });

  it("preserves the current query when status changes", () => {
    const result = updateCarrierFilterSearchParams(new URLSearchParams("q=Dachser"), {
      state: "inactive",
    });
    expect(result.toString()).toBe("q=Dachser&status=inactive");
  });

  it("preserves the current status when the query changes", () => {
    const result = updateCarrierFilterSearchParams(new URLSearchParams("status=all"), {
      query: "Dachser",
    });
    expect(result.toString()).toBe("status=all&q=Dachser");
  });

  it("can apply a typed query and a status selection in one navigation", () => {
    const result = updateCarrierFilterSearchParams(new URLSearchParams(), {
      query: "Dachser",
      state: "all",
    });
    expect(result.toString()).toBe("q=Dachser&status=all");
  });

  it("removes an empty query and uses an implicit active status", () => {
    const result = updateCarrierFilterSearchParams(
      new URLSearchParams("q=Dachser&status=inactive"),
      { query: "", state: "active" }
    );
    expect(result.toString()).toBe("");
  });
});
