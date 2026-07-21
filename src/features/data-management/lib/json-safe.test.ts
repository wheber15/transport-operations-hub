import { describe, expect, it } from "vitest";
import { SpreadsheetJsonSerializationError, toJsonSafeValue } from "./json-safe";

describe("spreadsheet JSON normalization", () => {
  it("densifies sparse arrays and converts undefined values to null", () => {
    const sparse: unknown[] = [];
    sparse[2] = "9108325189";
    expect(toJsonSafeValue(sparse)).toEqual([null, null, "9108325189"]);
  });
  it("preserves SAP identifiers as strings and serializes nested dates", () => {
    expect(
      toJsonSafeValue({
        delivery: "9108325189",
        nested: { date: new Date("2026-07-23T00:00:00Z") },
      })
    ).toEqual({ delivery: "9108325189", nested: { date: "2026-07-23T00:00:00.000Z" } });
  });
  it("rejects unsupported object values", () => {
    expect(() => toJsonSafeValue(new Map())).toThrow(SpreadsheetJsonSerializationError);
  });
});
