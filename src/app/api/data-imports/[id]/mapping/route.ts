import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import { saveMapping } from "@/features/data-management/application/data-import-service";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    return NextResponse.json({
      data: await saveMapping(user, (await params).id, await request.json()),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_MAPPING",
          message: error instanceof Error ? error.message : "Mapping failed.",
        },
      },
      { status: 400 }
    );
  }
}
