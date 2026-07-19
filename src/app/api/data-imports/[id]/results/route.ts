import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import { getBatch } from "@/features/data-management/application/data-import-service";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { batch } = await getBatch(user, (await params).id);
    return NextResponse.json({
      data: {
        id: batch.id,
        status: batch.status,
        counts: {
          total: batch.totalRows,
          valid: batch.validRows,
          imported: batch.importedRows,
          skipped: batch.skippedRows,
          failed: batch.failedRows,
        },
        committedAt: batch.committedAt,
        rows: batch.rows.slice(0, 100).map((row) => ({
          sourceRowNumber: row.sourceRowNumber,
          identifier: row.identifier,
          classification: row.classification,
          message: row.message,
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Import results are unavailable." } },
      { status: 404 }
    );
  }
}
