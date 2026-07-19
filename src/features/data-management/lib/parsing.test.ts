import { describe, expect, it } from "vitest";
import {
  neutralizeCsvCell,
  normalizeIdentifier,
  parseBusinessDate,
  parseSapWeight,
} from "./parsing";

describe("SAP parsing", () => {
  it.each([
    ["7,000 KG", "7.000"],
    ["1,500 KG", "1.500"],
    ["89,302 KG", "89.302"],
    ["1.495,872 KG", "1495.872"],
  ])("parses %s", (input, expected) => expect(parseSapWeight(input)).toBe(expected));
  it("rejects ambiguous, malformed, negative, and excess precision weights", () => {
    expect(parseSapWeight("1,234.5")).toBeNull();
    expect(parseSapWeight("-7,000 KG")).toBeNull();
    expect(parseSapWeight("7,0001 KG")).toBeNull();
  });
  it("uses day-first and date-only outputs", () => {
    expect(parseBusinessDate("29/02/2024")).toBe("2024-02-29");
    expect(parseBusinessDate("29-02-2024")).toBe("2024-02-29");
    expect(parseBusinessDate("2024-02-29")).toBe("2024-02-29");
    expect(parseBusinessDate("45292")).toBe("2024-01-01");
    expect(parseBusinessDate("31/02/2024")).toBeNull();
  });
  it("preserves identifiers and neutralizes formulas", () => {
    expect(normalizeIdentifier(" 000123 ")).toBe("000123");
    expect(neutralizeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(neutralizeCsvCell("Delivery")).toBe("Delivery");
  });
});
