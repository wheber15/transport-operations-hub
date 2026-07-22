import "server-only";

import ExcelJS from "exceljs";

import type { OrdersLeftWorkbookRow } from "@/features/orders/domain/orders-left";

const columns = ["Delivery Number", "Customer Name", "Weight (kg)", "Calculated Pallets"] as const;

export async function createOrdersLeftWorkbook(rows: OrdersLeftWorkbookRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AXon";
  const worksheet = workbook.addWorksheet("Orders Left", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.properties.defaultRowHeight = 15;
  worksheet.columns = [
    { header: columns[0], key: "deliveryNumber", width: 20 },
    { header: columns[1], key: "customerName", width: 36 },
    { header: columns[2], key: "weightKg", width: 15 },
    { header: columns[3], key: "calculatedPallets", width: 20 },
  ];
  const header = worksheet.getRow(1);
  header.font = { name: "Arial", size: 10, bold: true };
  header.alignment = { vertical: "middle" };
  header.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } };
  });

  for (const row of rows) {
    const worksheetRow = worksheet.addRow({
      deliveryNumber: row.deliveryNumber,
      customerName: row.customerName,
      weightKg: row.weightKg === null ? null : Number(row.weightKg),
      calculatedPallets: row.calculatedPallets,
    });
    worksheetRow.font = { name: "Arial", size: 10 };
    worksheetRow.getCell("deliveryNumber").numFmt = "@";
    worksheetRow.getCell("weightKg").numFmt = "#,##0.000";
    worksheetRow.getCell("calculatedPallets").numFmt = "0";
  }
  worksheet.autoFilter = { from: "A1", to: `D${Math.max(rows.length + 1, 1)}` };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export { columns as ordersLeftWorkbookColumns };
