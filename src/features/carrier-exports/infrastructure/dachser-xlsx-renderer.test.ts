import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  dachserHeaders,
  datasetChecksum,
  type DachserRow,
} from "@/features/carrier-exports/domain/dachser-export";
import { dachserInitialPresentationProfile, renderDachserXlsx } from "./dachser-xlsx-renderer";
const row: DachserRow = {
  shipmentNumber: "SHIP-001",
  salesOrderNumber: "=SO-1",
  deliveryNumber: "0001",
  shipToParty: "0002",
  soldToName1: "B",
  shipToName2: "Receiving desk",
  street: "Street",
  city: "City",
  postalCode: "001",
  region: "GW",
  totalWeightKg: "750.001",
  palletUnit: 2,
  goodsIssueDate: "2026-07-22",
  carrierId: "carrier",
};
describe("Dachser XLSX", () => {
  it("round-trips the complete 12-column transfer layout with the default hidden-column profile", async () => {
    const content = await renderDachserXlsx(
      [{ ...row, deliveryNumber: "0002", soldToName1: "A" }, row],
      { newDeliveryNumbers: new Set(["0002"]) }
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(content).buffer);
    const sheet = workbook.getWorksheet("Sheet1");
    expect(sheet?.rowCount).toBe(3);
    const headerValues = sheet?.getRow(1).values;
    expect(Array.isArray(headerValues) ? headerValues.slice(1) : []).toEqual([...dachserHeaders]);
    expect(sheet?.columnCount).toBe(12);
    expect(sheet?.getColumn(1).hidden).toBe(true);
    expect(sheet?.getColumn(6).hidden).toBe(true);
    expect(sheet?.getColumn(2).hidden).not.toBe(true);
    expect(sheet?.getColumn(1).values).toContain("SHIP-001");
    expect(sheet?.getColumn(6).values).toContain("Receiving desk");
    expect(sheet?.getCell("C2").value).toBe("0002");
    expect(sheet?.getCell("B3").value).toBe("'=SO-1");
    expect(sheet?.getCell("K2").value).toBe(750.001);
    expect(sheet?.getCell("L2").value).toBe(2);
    expect(sheet?.getCell("A1").font?.name).toBe("Arial");
    expect(sheet?.getCell("A1").font?.size).toBe(10);
    const headerFill = sheet?.getCell("A1").fill;
    const firstRowFill = sheet?.getCell("A2").fill;
    expect(headerFill?.type === "pattern" ? headerFill.fgColor?.argb : undefined).toBe("FFFF8080");
    expect(sheet?.getCell("A1").border.top?.style).toBe("thin");
    expect(firstRowFill?.type === "pattern" ? firstRowFill.fgColor?.argb : undefined).toBe(
      "FFFFFF00"
    );
    expect(sheet?.getColumn(1).width).toBe(17.27);
    expect(sheet?.autoFilter).toBe("A1:L3");
  });

  it("allows a profile to change visibility without changing worksheet data or dataset identity", async () => {
    const checksumInput = {
      carrierId: row.carrierId!,
      goodsIssueDate: row.goodsIssueDate!,
      stage: "INITIAL" as const,
      baselineReference: null,
      rendererVersion: "1",
      calculationVersion: "1",
      rows: [row],
    };
    const before = datasetChecksum(checksumInput);
    const content = await renderDachserXlsx([row], {
      presentationProfile: { hiddenHeaders: [] },
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(content).buffer);
    const sheet = workbook.getWorksheet("Sheet1");

    expect(dachserInitialPresentationProfile.hiddenHeaders).toEqual([
      "Shipment Number",
      "Ship-to Name2",
    ]);
    expect(sheet?.getColumn(1).hidden).not.toBe(true);
    expect(sheet?.getColumn(6).hidden).not.toBe(true);
    const headerValues = sheet?.getRow(1).values;
    expect(Array.isArray(headerValues) ? headerValues.slice(1) : []).toEqual([...dachserHeaders]);
    expect(sheet?.getCell("A2").value).toBe("SHIP-001");
    expect(sheet?.getCell("F2").value).toBe("Receiving desk");
    expect(datasetChecksum(checksumInput)).toBe(before);
  });

  it("keeps a pre-shipment Initial row exportable with a blank Shipment Number", async () => {
    const content = await renderDachserXlsx([
      {
        ...row,
        shipmentNumber: null,
        shipToName2: null,
        street: null,
        city: null,
        postalCode: null,
        region: null,
      },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(content).buffer);
    const sheet = workbook.getWorksheet("Sheet1");

    expect(sheet?.getCell("A2").value).toBe("");
    expect(sheet?.getCell("F2").value).toBe("");
    expect(sheet?.getCell("G2").value).toBe("");
    expect(sheet?.getCell("K2").value).toBe(750.001);
    expect(sheet?.getCell("L2").value).toBe(2);
  });
});
