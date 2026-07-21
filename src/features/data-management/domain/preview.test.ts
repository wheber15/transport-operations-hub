import { describe, expect, it } from "vitest";
import { formatSapWeight, getImportClassificationLabel } from "./preview";

describe("import preview presentation", () => {
  it.each([
    ["7.000", "7.000 kg"],
    ["89.302", "89.302 kg"],
    ["1495.872", "1495.872 kg"],
  ])("formats decimal-safe SAP weight %s", (value, expected) => {
    expect(formatSapWeight(value)).toBe(expected);
  });

  it("uses planner-readable classification labels", () => {
    expect(getImportClassificationLabel("relatedRecordNotFound")).toBe("Delivery not found");
    expect(getImportClassificationLabel("validUpdate")).toBe("Ready to update");
  });
});
