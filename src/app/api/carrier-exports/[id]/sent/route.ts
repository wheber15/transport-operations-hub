import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  CarrierExportForbiddenError,
  CarrierExportNotFoundError,
  markCarrierExportSent,
} from "@/features/carrier-exports/application/carrier-export-service";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/carrier-exports/[id]/sent">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id } = await context.params;
    await markCarrierExportSent(user, id);
    return NextResponse.json({ data: { markedSent: true } });
  } catch (error) {
    if (error instanceof CarrierExportForbiddenError)
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to mark Carrier Exports as sent.",
          },
        },
        { status: 403 }
      );
    if (error instanceof CarrierExportNotFoundError || error instanceof ZodError)
      return NextResponse.json(
        {
          error: {
            code: "EXPORT_NOT_AVAILABLE",
            message: "This Carrier Export cannot be marked as sent.",
          },
        },
        { status: 409 }
      );
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "The Carrier Export could not be updated safely.",
        },
      },
      { status: 500 }
    );
  }
}
