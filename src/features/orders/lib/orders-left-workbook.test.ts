import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { createOrdersLeftWorkbook, ordersLeftWorkbookColumns } from "./orders-left-workbook";

describe("Orders left workbook", () => {
  it("contains only the operational columns with typed values", async () => {
    const bytes = await createOrdersLeftWorkbook([
      {
        customerName: "A Customer",
        deliveryNumber: "0000000123",
        weightKg: "2403.000",
        calculatedPallets: 4,
      },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet("Orders Left")!;
    expect(sheet.getRow(1).values.slice(1)).toEqual(ordersLeftWorkbookColumns);
    expect(sheet.columnCount).toBe(4);
    expect(sheet.getCell("A2").value).toBe("0000000123");
    expect(sheet.getCell("A2").numFmt).toBe("@");
    expect(sheet.getCell("C2").value).toBe(2403);
    expect(sheet.getCell("D2").value).toBe(4);
    expect(sheet.autoFilter).toBeDefined();
  });

  it("freezes the header row and has no embedded formulas", async () => {
    const bytes = await createOrdersLeftWorkbook([
      { customerName: "A Customer", deliveryNumber: "1", weightKg: "1.000", calculatedPallets: 1 },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet("Orders Left")!;
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getCell("D2").value).toBe(1);
  });
});
