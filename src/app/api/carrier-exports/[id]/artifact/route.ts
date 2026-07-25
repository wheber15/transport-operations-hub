import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  CarrierExportForbiddenError,
  CarrierExportNotFoundError,
  getCarrierExportArtifact,
  recordCarrierExportDownload,
} from "@/features/carrier-exports/application/carrier-export-service";
import { getLocalCarrierExportArtifactStorage } from "@/features/carrier-exports/infrastructure/local-carrier-export-artifact-storage";

export const runtime = "nodejs";

function contentDisposition(filename: string) {
  return `attachment; filename="${filename.replace(/[\\/\r\n"]/g, "_")}"`;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/carrier-exports/[id]/artifact">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id } = await context.params;
    const artifact = await getCarrierExportArtifact(user, id);
    const stored = await getLocalCarrierExportArtifactStorage().open({
      storageKey: artifact.storageKey,
      checksumSha256: artifact.checksumSha256,
    });
    if (!stored || stored.byteSize !== artifact.byteSize) throw new CarrierExportNotFoundError();
    const { byteSize, contentType, filename } = artifact;
    await recordCarrierExportDownload(user, id);
    return new NextResponse(stored.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(filename),
        "Content-Length": byteSize.toString(),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    if (error instanceof CarrierExportForbiddenError)
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to download Carrier Exports.",
          },
        },
        { status: 403 }
      );
    if (error instanceof CarrierExportNotFoundError || error instanceof ZodError)
      return NextResponse.json(
        {
          error: {
            code: "ARTIFACT_NOT_AVAILABLE",
            message: "This Carrier Export artifact is not available.",
          },
        },
        { status: 404 }
      );
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "The Carrier Export artifact is unavailable.",
        },
      },
      { status: 500 }
    );
  }
}
