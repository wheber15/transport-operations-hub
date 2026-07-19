import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import { commitImport } from "@/features/data-management/application/data-import-service";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    return NextResponse.json({ data: await commitImport(user, (await params).id) });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "COMMIT_FAILED",
          message: error instanceof Error ? error.message : "Commit failed.",
        },
      },
      { status: 400 }
    );
  }
}
