import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  DataImportForbiddenError,
  getBatch,
} from "@/features/data-management/application/data-import-service";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const result = await getBatch(user, (await params).id);
    return NextResponse.json({
      data: {
        id: result.batch.id,
        importType: result.batch.importType,
        status: result.batch.status,
        originalFileName: result.batch.originalFileName,
        selectedSheetName: result.batch.selectedSheetName,
        selectedHeaderRow: result.batch.selectedHeaderRow,
        sheets: result.sheets,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: error instanceof DataImportForbiddenError ? "FORBIDDEN" : "NOT_FOUND",
          message: "Import batch is unavailable.",
        },
      },
      { status: error instanceof DataImportForbiddenError ? 403 : 404 }
    );
  }
}
