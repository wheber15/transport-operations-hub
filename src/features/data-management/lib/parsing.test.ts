import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  neutralizeCsvCell,
  normalizeIdentifier,
  parseBusinessDate,
  parseSapWeight,
  parseImportFile,
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
  it.each([
    ["747936", "747.936"],
    ["92273", "92.273"],
    ["254557", "254.557"],
    ["2956.495", "2956.495"],
    ["7.358", "7.358"],
    ["750.001", "750.001"],
  ])("parses numeric SAP cell %s as %s kg", (input, expected) =>
    expect(parseSapWeight(input, "numeric")).toBe(expected));
  it.each([
    ["2.403,421", "2403.421"],
    ["1.387,836", "1387.836"],
    ["2956.495", "2956.495"],
    ["750.001", "750.001"],
  ])("parses explicit SAP text %s as %s kg", (input, expected) =>
    expect(parseSapWeight(input, "text")).toBe(expected));
  it("rejects ambiguous integer text and non-positive values", () => {
    expect(parseSapWeight("747936", "text")).toBeNull();
    expect(parseSapWeight("0", "numeric")).toBeNull();
    expect(parseSapWeight("-7", "numeric")).toBeNull();
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
  it("reads a genuine Office 2007 XLSX from its original binary buffer", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("SAP Order Book");
    sheet.addRow(["Sales Document", "Originating Document"]);
    sheet.addRow([9108325189, 1046227772]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const file = new File([bytes], "sap-order-book.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseImportFile(file);
    expect(parsed.sheets).toEqual([
      expect.objectContaining({
        name: "SAP Order Book",
        rows: [
          ["Sales Document", "Originating Document"],
          ["9108325189", "1046227772"],
        ],
      }),
    ]);
  });
  it("rejects a non-XLSX binary before sending it to the XLSX parser", async () => {
    await expect(
      parseImportFile(
        new File(["not a workbook"], "sap-order-book.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      )
    ).rejects.toThrow("malformed");
  });
  it("trims trailing formatted blank rows but preserves internal blank source rows", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(["Header"]);
    sheet.addRow(["first"]);
    sheet.addRow([]);
    sheet.addRow(["last"]);
    sheet.getRow(1004).height = 15;
    const file = new File([Buffer.from(await workbook.xlsx.writeBuffer())], "trim.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const parsed = await parseImportFile(file);
    expect(parsed.sheets[0].rows).toEqual([["Header"], ["first"], [], ["last"]]);
  });
});
