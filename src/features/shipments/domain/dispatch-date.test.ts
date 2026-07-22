import { describe, expect, it } from "vitest";

import { resolveDispatchDateScope } from "./dispatch-date";

describe("Shipment dispatch-date presets", () => {
  it("uses Ireland business dates for Today and Yesterday", () => {
    const reference = new Date("2026-01-01T12:00:00.000Z");
    expect(resolveDispatchDateScope("today", reference)).toEqual({
      from: "2026-01-01",
      to: "2026-01-01",
    });
    expect(resolveDispatchDateScope("yesterday", reference)).toEqual({
      from: "2025-12-31",
      to: "2025-12-31",
    });
  });

  it("uses an inclusive Monday through Sunday scope for This Week", () => {
    expect(resolveDispatchDateScope("thisWeek", new Date("2026-07-21T12:00:00.000Z"))).toEqual({
      from: "2026-07-20",
      to: "2026-07-26",
    });
  });

  it("preserves an explicit custom range", () => {
    expect(
      resolveDispatchDateScope("custom", new Date(), { from: "2026-07-20", to: "2026-07-22" })
    ).toEqual({ from: "2026-07-20", to: "2026-07-22" });
  });
});
