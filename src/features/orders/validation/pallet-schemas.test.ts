import { describe, expect, it } from "vitest";

import { palletSetSchema } from "./pallet-schemas";

describe("pallet capture validation", () => {
  it("accepts one or more valid pallet weights", () => {
    expect(
      palletSetSchema.parse({ pallets: [{ sequenceNumber: 1, actualWeightKg: "420" }] }).pallets
    ).toHaveLength(1);
    expect(
      palletSetSchema.parse({
        pallets: [
          { sequenceNumber: 1, actualWeightKg: "420" },
          { sequenceNumber: 2, actualWeightKg: "395.125" },
        ],
      }).pallets
    ).toHaveLength(2);
  });

  it.each(["", "0", "-1", "12.1234", "Infinity", "weight"])(
    "rejects invalid pallet weight %p",
    (actualWeightKg) => {
      expect(() =>
        palletSetSchema.parse({ pallets: [{ sequenceNumber: 1, actualWeightKg }] })
      ).toThrow();
    }
  );

  it("allows an empty replacement set to clear captured pallets", () => {
    expect(palletSetSchema.parse({ pallets: [] }).pallets).toEqual([]);
  });
});
