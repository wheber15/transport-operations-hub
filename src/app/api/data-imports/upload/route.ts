import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  DataImportForbiddenError,
  uploadImport,
} from "@/features/data-management/application/data-import-service";
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "A spreadsheet file is required." } },
        { status: 400 }
      );
    const batch = await uploadImport(user, form.get("importType"), file);
    return NextResponse.json(
      { data: { id: batch.id, totalRows: batch.totalRows, sheets: [batch.selectedSheetName] } },
      { status: 201 }
    );
  } catch (error) {
    const status = error instanceof DataImportForbiddenError ? 403 : 400;
    const code =
      error instanceof Error && error.message === "SAP_ORDER_BOOK_REQUIRED"
        ? "SAP_ORDER_BOOK_REQUIRED"
        : error instanceof Error &&
            ["HEADER_NOT_FOUND", "NO_PROCESSED_ROWS", "CONFLICTING_DETAIL_DATA"].includes(
              error.message
            )
          ? error.message
          : "INVALID_IMPORT";
    return NextResponse.json(
      {
        error: {
          code: status === 403 ? "FORBIDDEN" : code,
          message:
            code === "SAP_ORDER_BOOK_REQUIRED"
              ? "This workbook appears to be an SAP Order Book. Select SAP Order Book rather than Delivery Reference."
              : code === "HEADER_NOT_FOUND"
                ? "SAP Order Book headers were not found in this workbook."
                : code === "NO_PROCESSED_ROWS"
                  ? "No processed SAP delivery rows were found in this workbook."
                  : code === "CONFLICTING_DETAIL_DATA"
                    ? "More than one SAP Order Book table was found. Upload one operational table at a time."
                    : "The spreadsheet could not be staged safely.",
        },
      },
      { status }
    );
  }
}
