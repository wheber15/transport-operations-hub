import "server-only";
import ExcelJS from "exceljs";
import {
  dachserHeaders,
  exportText,
  type DachserRow,
} from "@/features/carrier-exports/domain/dachser-export";

const columnWidths = [
  17.27, 24.82, 11.73, 16.45, 39.54, 32.18, 34.82, 21.18, 15.18, 10.82, 13.18, 13.45,
];

type DachserColumnHeader = (typeof dachserHeaders)[number];

export type DachserColumnPresentationProfile = {
  readonly hiddenHeaders: readonly DachserColumnHeader[];
};

export const dachserInitialPresentationProfile: DachserColumnPresentationProfile = {
  hiddenHeaders: ["Shipment Number", "Ship-to Name2"],
};

type DachserXlsxOptions = {
  includeFooter?: boolean;
  newDeliveryNumbers?: ReadonlySet<string>;
  presentationProfile?: DachserColumnPresentationProfile;
};

// ExcelJS writes RGB colours. FFFF8080 is the standard Excel indexed-palette colour 22.
const headerFill = "FFFF8080";
const newRowFill = "FFFFFF00";
const thinBorder = {
  top: { style: "thin" as const, color: { argb: "FF000000" } },
  left: { style: "thin" as const, color: { argb: "FF000000" } },
  bottom: { style: "thin" as const, color: { argb: "FF000000" } },
  right: { style: "thin" as const, color: { argb: "FF000000" } },
};

export async function renderDachserXlsx(
  rows: DachserRow[],
  options: DachserXlsxOptions = {}
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.properties.defaultRowHeight = 15;
  sheet.views = [{ showGridLines: false }];
  const hiddenHeaders = new Set(
    (options.presentationProfile ?? dachserInitialPresentationProfile).hiddenHeaders
  );
  columnWidths.forEach((width, index) => {
    const column = sheet.getColumn(index + 1);
    column.width = width;
    column.hidden = hiddenHeaders.has(dachserHeaders[index]!);
  });
  sheet.addRow([...dachserHeaders]);
  const header = sheet.getRow(1);
  header.height = 15;
  header.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } };
    cell.border = thinBorder;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const row of [...rows].sort(
    (a, b) =>
      (a.soldToName1 ?? "").localeCompare(b.soldToName1 ?? "") ||
      (a.deliveryNumber ?? "").localeCompare(b.deliveryNumber ?? "")
  )) {
    const worksheetRow = sheet.addRow([
      exportText(row.shipmentNumber),
      exportText(row.salesOrderNumber),
      exportText(row.deliveryNumber),
      exportText(row.shipToParty),
      exportText(row.soldToName1),
      exportText(row.shipToName2),
      exportText(row.street),
      exportText(row.city),
      exportText(row.postalCode),
      exportText(row.region),
      row.totalWeightKg === null ? null : Number(row.totalWeightKg),
      row.palletUnit,
    ]);
    worksheetRow.height = 15;
    worksheetRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
    worksheetRow.getCell(11).alignment = { vertical: "middle", horizontal: "right" };
    worksheetRow.getCell(12).alignment = { vertical: "middle", horizontal: "right" };
    if (row.deliveryNumber && options.newDeliveryNumbers?.has(row.deliveryNumber)) {
      worksheetRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: newRowFill } };
      });
    }
  }
  sheet.getColumn(3).numFmt = "@";
  sheet.getColumn(4).numFmt = "@";
  sheet.getColumn(9).numFmt = "@";
  sheet.getColumn(11).numFmt = "# ,##0.000".replace(" ", "");
  sheet.getColumn(12).numFmt = "0";
  sheet.autoFilter = { from: "A1", to: `L${sheet.rowCount}` };
  if (options.includeFooter) sheet.addRow(["", "", "", "", "", "", "", "", "", "", "", ""]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
