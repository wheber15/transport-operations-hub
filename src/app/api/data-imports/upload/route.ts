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
    return NextResponse.json(
      {
        error: {
          code: status === 403 ? "FORBIDDEN" : "INVALID_IMPORT",
          message: error instanceof Error ? error.message : "The import could not be staged.",
        },
      },
      { status }
    );
  }
}
