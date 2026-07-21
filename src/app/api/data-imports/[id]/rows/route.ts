import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  DataImportForbiddenError,
  getImportPreviewRows,
} from "@/features/data-management/application/data-import-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const search = new URL(request.url).searchParams;
    const data = await getImportPreviewRows(user, (await params).id, {
      view: search.get("view") ?? undefined,
      page: search.get("page") ?? undefined,
      pageSize: search.get("pageSize") ?? undefined,
      classification: search.get("classification") ?? undefined,
      query: search.get("query") ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: error instanceof DataImportForbiddenError ? "FORBIDDEN" : "PREVIEW_UNAVAILABLE",
          message: error instanceof Error ? error.message : "Preview rows are unavailable.",
        },
      },
      { status: error instanceof DataImportForbiddenError ? 403 : 400 }
    );
  }
}
