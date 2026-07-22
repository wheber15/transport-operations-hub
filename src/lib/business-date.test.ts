import { describe, expect, it } from "vitest";
import { irelandBusinessDate, timestampMatchesIrelandBusinessDate } from "./business-date";
describe("Ireland business dates", () => {
  it("uses Dublin calendar dates across winter and summer boundaries", () => {
    expect(irelandBusinessDate(new Date("2026-01-01T00:30:00.000Z"))).toBe("2026-01-01");
    expect(irelandBusinessDate(new Date("2026-07-01T22:30:00.000Z"))).toBe("2026-07-01");
    expect(irelandBusinessDate(new Date("2026-07-01T23:30:00.000Z"))).toBe("2026-07-02");
  });
  it("compares timestamps with Ireland calendar business dates", () => {
    expect(
      timestampMatchesIrelandBusinessDate(new Date("2026-07-01T23:30:00.000Z"), "2026-07-02")
    ).toBe(true);
  });
});
