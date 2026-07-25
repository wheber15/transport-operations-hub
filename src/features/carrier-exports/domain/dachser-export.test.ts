import { describe, expect, it } from "vitest";
import {
  datasetChecksum,
  filename,
  rowChecksum,
  validateDachserRow,
  type DachserRow,
} from "./dachser-export";

const row: DachserRow = {
  shipmentNumber: null,
  salesOrderNumber: " SO-001 ",
  deliveryNumber: "0001",
  shipToParty: "0002",
  soldToName1: "Customer",
  shipToName2: null,
  street: "Street",
  city: "City",
  postalCode: "001",
  region: "GW",
  totalWeightKg: "750.001",
  palletUnit: 2,
  goodsIssueDate: "2026-07-22",
  carrierId: "carrier",
};
describe("Dachser export domain", () => {
  it("uses exact filenames", () => {
    expect(filename("2026-07-22", "INITIAL", 0)).toBe("CSV file for 22.07.2026.xlsx");
    expect(filename("2026-07-22", "UPDATE", 1)).toContain("(Update) (1)");
  });
  it("canonicalizes semantic text", () =>
    expect(rowChecksum(row)).toBe(rowChecksum({ ...row, salesOrderNumber: "SO-001" })));
  it("changes dataset identity", () => {
    const initial = datasetChecksum({
      carrierId: "carrier",
      goodsIssueDate: "2026-07-22",
      stage: "INITIAL",
      baselineReference: null,
      rendererVersion: "1",
      calculationVersion: "1",
      rows: [row],
    });
    const updated = datasetChecksum({
      carrierId: "carrier",
      goodsIssueDate: "2026-07-22",
      stage: "UPDATE",
      baselineReference: "A",
      rendererVersion: "1",
      calculationVersion: "1",
      rows: [row],
    });
    expect(initial).not.toBe(updated);
    expect(rowChecksum(row)).not.toBe(rowChecksum({ ...row, palletUnit: 3 }));
  });
  it("returns structured blockers", () => {
    expect(validateDachserRow({ ...row, salesOrderNumber: null, totalWeightKg: null })).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "INVALID_GROSS_WEIGHT" })])
    );
  });
  it("allows the optional shipment and destination presentation fields to remain blank", () => {
    expect(
      validateDachserRow({
        ...row,
        shipmentNumber: null,
        shipToName2: null,
        street: null,
        city: null,
        postalCode: null,
        region: null,
      })
    ).toEqual([]);
  });
  it("blocks missing required core fields without requiring a Shipment Number", () => {
    expect(
      validateDachserRow({
        ...row,
        shipmentNumber: null,
        salesOrderNumber: null,
        shipToParty: null,
        soldToName1: null,
      }).map((blocker) => blocker.code)
    ).toEqual(
      expect.arrayContaining(["MISSING_SALES_ORDER", "MISSING_SHIP_TO", "MISSING_SOLD_TO_NAME"])
    );
  });
});
