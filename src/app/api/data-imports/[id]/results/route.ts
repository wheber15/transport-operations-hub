import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import { getImportPreviewRows } from "@/features/data-management/application/data-import-service";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const search = new URL(_.url).searchParams;
    const result = await getImportPreviewRows(user, (await params).id, {
      view: "preview",
      page: search.get("page") ?? undefined,
      pageSize: search.get("pageSize") ?? undefined,
      classification: search.get("classification") ?? undefined,
      query: search.get("query") ?? undefined,
    });
    return NextResponse.json({
      data: {
        ...result,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Import results are unavailable." } },
      { status: 404 }
    );
  }
}
