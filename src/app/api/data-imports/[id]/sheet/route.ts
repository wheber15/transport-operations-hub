import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/features/auth/application/session";
import { selectSheet } from "@/features/data-management/application/data-import-service";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { sheetName } = z
      .object({ sheetName: z.string().min(1).max(255) })
      .parse(await request.json());
    return NextResponse.json({ data: await selectSheet(user, (await params).id, sheetName) });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_SHEET",
          message: error instanceof Error ? error.message : "Sheet selection failed.",
        },
      },
      { status: 400 }
    );
  }
}
