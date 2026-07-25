import { describe, expect, it } from "vitest";
import { correlateSapOrderBook } from "./sap-order-book";

const header = [
  "Traffic light",
  "Sales Document",
  "Route",
  "Shipping Point/Receiving Pt",
  "Originating Document",
  "Goods Issue Date",
  "Ship-To Party",
  "Open gross weight",
  "Weight Unit",
  "Name 1",
];

describe("SAP Order Book correlation", () => {
  it("detects headers after blank rows and combines a processed row with detail rows", () => {
    const result = correlateSapOrderBook([
      [],
      [],
      header,
      ["", "9108325189", "", "", "1046227772", "", "", "0", "KG", ""],
      ["", "", "IE1211", "DUB", "1046227772", "7/23/2026", "84032", "427.79", "KG", "Woodies"],
      ["", "", "IE1211", "DUB", "1046227772", "7/23/2026", "84032", "7,000 KG", "KG", "Woodies"],
    ]);
    expect(result.headerRowNumber).toBe(3);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      deliveryNumber: "9108325189",
      orderNumber: "1046227772",
      goodsIssueDate: "2026-07-23",
      grossWeightKg: "434.790",
      classification: "readyToCreate",
      detailRowNumbers: [5, 6],
    });
  });
  it("does not silently merge ambiguous Sales Order deliveries or conflicting detail data", () => {
    const result = correlateSapOrderBook([
      header,
      ["", "9100000001", "", "", "1040000001", "", "", "0", "KG", ""],
      ["", "9100000002", "", "", "1040000001", "", "", "0", "KG", ""],
      ["", "", "IE1211", "", "1040000001", "2026-07-23", "84032", "7,000 KG", "KG", "Woodies"],
      ["", "", "IE1411", "", "1040000001", "2026-07-24", "99999", "89,302 KG", "KG", "B&Q"],
    ]);
    expect(result.records).toHaveLength(2);
    expect(result.records.every((record) => record.classification === "requiresReview")).toBe(true);
    expect(result.records[0].conflicts).toHaveProperty("routeCode");
  });
  it("does not create a record for an unprocessed detail order", () => {
    const result = correlateSapOrderBook([
      header,
      ["", "", "IE1211", "", "1040000009", "2026-07-23", "84032", "7,000 KG", "KG", "Woodies"],
    ]);
    expect(result.records).toEqual([]);
    expect(result.unprocessedDetailOrders).toBe(1);
  });
  it("keeps a duplicate Delivery Number as one review record", () => {
    const result = correlateSapOrderBook([
      header,
      ["", "9100000001", "", "", "1040000001", "", "", "0", "KG", ""],
      ["", "9100000001", "", "", "1040000001", "", "", "0", "KG", ""],
      ["", "", "IE1211", "", "1040000001", "2026-07-23", "84032", "7,000 KG", "KG", "Woodies"],
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].classification).toBe("duplicateDelivery");
  });
  it("returns a row-level blocker for malformed SAP header identifiers", () => {
    const result = correlateSapOrderBook([
      header,
      ["", "not-a-delivery", "", "", "1040000001", "", "", "0", "KG", ""],
    ]);
    expect(result.records).toEqual([
      expect.objectContaining({
        classification: "invalidIdentifier",
        message: "Sales Document and Originating Document must be valid SAP numeric identifiers.",
      }),
    ]);
  });
});
