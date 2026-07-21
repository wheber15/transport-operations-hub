import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import { commitImport } from "@/features/data-management/application/data-import-service";

function logDevelopmentCheckpoint(checkpoint: string) {
  if (process.env.NODE_ENV === "development") console.info(`[data-import] ${checkpoint}`);
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id } = await params;
    logDevelopmentCheckpoint("commit route entered");
    const batch = await commitImport(user, id);
    logDevelopmentCheckpoint("commit response returned");
    return NextResponse.json({ data: batch });
  } catch (error) {
    const code =
      error instanceof Error && error.message === "BATCH_ALREADY_COMMITTED"
        ? "BATCH_ALREADY_COMMITTED"
        : "COMMIT_FAILED";
    logDevelopmentCheckpoint("commit route failed");
    return NextResponse.json(
      {
        error: {
          code,
          message:
            code === "BATCH_ALREADY_COMMITTED"
              ? "This import has already been committed."
              : "The import could not be committed. Review the preview and try again.",
        },
      },
      { status: code === "BATCH_ALREADY_COMMITTED" ? 409 : 400 }
    );
  }
}
