import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import { previewImport } from "@/features/data-management/application/data-import-service";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const batch = await previewImport(user, (await params).id);
    return NextResponse.json({
      data: {
        id: batch?.id,
        status: batch?.status,
        totalRows: batch?.totalRows,
        validRows: batch?.validRows,
        rows: batch?.rows.slice(0, 100).map((row) => ({
          sourceRowNumber: row.sourceRowNumber,
          identifier: row.identifier,
          classification: row.classification,
          message: row.message,
          currentValues: row.currentValues,
          proposedValues: row.proposedValues,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "PREVIEW_FAILED",
          message: error instanceof Error ? error.message : "Preview failed.",
        },
      },
      { status: 400 }
    );
  }
}
