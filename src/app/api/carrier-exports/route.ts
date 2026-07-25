import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  CarrierExportDuplicateError,
  CarrierExportStateError,
} from "@/features/carrier-exports/infrastructure/carrier-export-repository";
import {
  CarrierExportCarrierNotFoundError,
  CarrierExportFieldsUnavailableError,
  CarrierExportForbiddenError,
  CarrierExportGenerationError,
  CarrierExportPreviewBlockedError,
  generateCarrierExport,
  listCarrierExportHistory,
} from "@/features/carrier-exports/application/carrier-export-service";

function unauthenticated() {
  return NextResponse.json(
    { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
    { status: 401 }
  );
}

function errorResponse(error: unknown) {
  if (error instanceof CarrierExportForbiddenError)
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to manage Carrier Exports.",
        },
      },
      { status: 403 }
    );
  if (error instanceof CarrierExportFieldsUnavailableError)
    return NextResponse.json(
      {
        error: {
          code: "EXPORT_FIELDS_UNAVAILABLE",
          message: "Carrier Exports are unavailable until the pending data migration is applied.",
        },
      },
      { status: 409 }
    );
  if (error instanceof CarrierExportCarrierNotFoundError)
    return NextResponse.json(
      {
        error: {
          code: "CARRIER_NOT_FOUND",
          message: "Select an active Carrier before generating an export.",
        },
      },
      { status: 404 }
    );
  if (error instanceof CarrierExportPreviewBlockedError)
    return NextResponse.json(
      {
        error: {
          code: "EXPORT_BLOCKED",
          message: "Resolve all preview blockers before generating an export.",
        },
      },
      { status: 422 }
    );
  if (error instanceof CarrierExportDuplicateError)
    return NextResponse.json(
      {
        error: { code: "DUPLICATE_EXPORT", message: "An identical Carrier Export already exists." },
      },
      { status: 409 }
    );
  if (error instanceof CarrierExportStateError)
    return NextResponse.json(
      {
        error: {
          code: "BASELINE_UNAVAILABLE",
          message: "A compatible sent or generated baseline is required for this export.",
        },
      },
      { status: 409 }
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: { code: "INVALID_EXPORT", message: "Review the Carrier Export fields." } },
      { status: 400 }
    );
  if (error instanceof CarrierExportGenerationError)
    return NextResponse.json(
      {
        error: {
          code: "EXPORT_GENERATION_FAILED",
          message: "The Carrier Export could not be generated safely.",
        },
      },
      { status: 500 }
    );
  return NextResponse.json(
    { error: { code: "INTERNAL_SERVER_ERROR", message: "Carrier Exports are unavailable." } },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();
  try {
    const { searchParams } = new URL(request.url);
    const carrierId = searchParams.get("carrierId") ?? undefined;
    const goodsIssueDate = searchParams.get("goodsIssueDate") ?? undefined;
    return NextResponse.json({
      data: await listCarrierExportHistory(user, { carrierId, goodsIssueDate }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();
  try {
    return NextResponse.json(
      { data: await generateCarrierExport(user, await request.json()) },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
