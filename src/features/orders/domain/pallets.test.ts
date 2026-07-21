import { describe, expect, it } from "vitest";

import { calculatePalletWeightSummary, estimatePalletCount, isValidPalletWeight } from "./pallets";

describe("pallet weight domain", () => {
  it("derives exact three-decimal totals and variance for one Delivery", () => {
    expect(calculatePalletWeightSummary(["8.250", "7.940", "9.110", "7.320"], "32.620")).toEqual({
      palletCount: 4,
      actualPalletWeightKg: "32.620",
      varianceKg: "0.000",
      status: "captured",
    });
  });

  it("keeps no pallet rows distinct from a zero count", () => {
    expect(calculatePalletWeightSummary([], "32.620")).toEqual({
      palletCount: 0,
      actualPalletWeightKg: null,
      varianceKg: null,
      status: "awaitingActual",
    });
  });

  it("uses the central 750 kg planning rule and rounds estimates up", () => {
    expect(estimatePalletCount("749.000")).toBe(1);
    expect(estimatePalletCount("750.000")).toBe(1);
    expect(estimatePalletCount("751.000")).toBe(2);
    expect(estimatePalletCount(null)).toBeNull();
  });

  it("does not merge independent Delivery pallet sets", () => {
    expect(calculatePalletWeightSummary(["8.250"], "8.250").actualPalletWeightKg).toBe("8.250");
    expect(calculatePalletWeightSummary(["7.940"], "7.940").actualPalletWeightKg).toBe("7.940");
  });

  it("rejects zero, negative, excessive, and imprecise weights", () => {
    expect(isValidPalletWeight("0")).toBe(false);
    expect(isValidPalletWeight("-1.000")).toBe(false);
    expect(isValidPalletWeight("1000.001")).toBe(false);
    expect(isValidPalletWeight("8.1234")).toBe(false);
    expect(isValidPalletWeight("8.250")).toBe(true);
  });

  it("reports a captured set regardless of whether it is over, under, or equal to SAP gross weight", () => {
    expect(calculatePalletWeightSummary(["420", "395", "405"], "1200")).toEqual({
      palletCount: 3,
      actualPalletWeightKg: "1220.000",
      varianceKg: "20.000",
      status: "captured",
    });
    expect(calculatePalletWeightSummary(["400"], "1200").varianceKg).toBe("-800.000");
  });
});
