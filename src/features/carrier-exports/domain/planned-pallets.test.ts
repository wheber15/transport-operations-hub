import { describe, expect, it } from "vitest";
import { calculatePlannedPalletUnit } from "./planned-pallets";
describe("Dachser planned pallet calculation", () => {
  it.each([
    ["1", 1],
    ["749.999", 1],
    ["750", 1],
    ["750.001", 2],
    ["1500", 2],
    ["1500.001", 3],
    ["2250", 3],
    ["2250.001", 4],
    ["2956.495", 4],
    ["2580.673", 4],
  ])("ceilings %s kg", (weight, expected) =>
    expect(calculatePlannedPalletUnit(weight)).toBe(expected)
  );
  it.each([null, "0", "-1", "not-a-number"])("blocks invalid weight %s", (weight) =>
    expect(calculatePlannedPalletUnit(weight)).toBeNull()
  );
});
