import { describe, expect, it } from "vitest";
import { carrierInputSchema } from "./carrier-schemas";

const base = { carrierNumber: "C0001", name: "AXon Logistics", active: true };
describe("carrier validation", () => {
  it("requires and trims Carrier identity while preserving leading zeros", () => {
    expect(() => carrierInputSchema.parse({ ...base, carrierNumber: "" })).toThrow();
    expect(
      carrierInputSchema.parse({ ...base, carrierNumber: "  C0001  ", name: "  AXon Logistics  " })
    ).toMatchObject({ carrierNumber: "C0001", name: "AXon Logistics" });
  });
  it("validates optional contact and operational information", () => {
    expect(
      carrierInputSchema.parse({
        ...base,
        email: "",
        phone: "+353 (1) 555-0100 ext. 2",
        collectionStartTime: "07:00",
        collectionEndTime: "16:30",
        dailyTrailerLimit: "4",
      })
    ).toMatchObject({
      email: null,
      phone: "+353 (1) 555-0100 ext. 2",
      collectionStartTime: "07:00",
      collectionEndTime: "16:30",
      dailyTrailerLimit: 4,
    });
    expect(() =>
      carrierInputSchema.parse({
        ...base,
        email: "invalid",
        collectionStartTime: "25:61",
        collectionEndTime: "26:00",
      })
    ).toThrow();
  });
  it("requires a valid ordered pair or neither collection window value", () => {
    expect(
      carrierInputSchema.parse({ ...base, collectionStartTime: "", collectionEndTime: "" })
    ).toMatchObject({ collectionStartTime: null, collectionEndTime: null });
    for (const value of [
      { collectionStartTime: "07:00" },
      { collectionEndTime: "17:00" },
      { collectionStartTime: "17:00", collectionEndTime: "07:00" },
      { collectionStartTime: "07:00", collectionEndTime: "07:00" },
    ])
      expect(() => carrierInputSchema.parse({ ...base, ...value })).toThrow();
  });
  it.each(["0", "-1", "1.5"])("rejects invalid trailer limit %s", (dailyTrailerLimit) => {
    expect(() => carrierInputSchema.parse({ ...base, dailyTrailerLimit })).toThrow();
  });
});
