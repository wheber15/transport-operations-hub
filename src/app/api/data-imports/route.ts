import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  DataImportForbiddenError,
  listImportBatches,
} from "@/features/data-management/application/data-import-service";
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    return NextResponse.json({ data: await listImportBatches(user) });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: error instanceof DataImportForbiddenError ? "FORBIDDEN" : "UNAVAILABLE",
          message: "Import history is unavailable.",
        },
      },
      { status: error instanceof DataImportForbiddenError ? 403 : 500 }
    );
  }
}
