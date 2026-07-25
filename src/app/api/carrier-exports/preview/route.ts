import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  CarrierExportCarrierNotFoundError,
  CarrierExportFieldsUnavailableError,
  CarrierExportForbiddenError,
  getCarrierExportPreview,
} from "@/features/carrier-exports/application/carrier-export-service";
import { CarrierExportStateError } from "@/features/carrier-exports/infrastructure/carrier-export-repository";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    return NextResponse.json({ data: await getCarrierExportPreview(user, await request.json()) });
  } catch (error) {
    if (error instanceof CarrierExportForbiddenError)
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to preview Carrier Exports.",
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
            message: "Select an active Carrier before previewing an export.",
          },
        },
        { status: 404 }
      );
    if (error instanceof CarrierExportStateError)
      return NextResponse.json(
        {
          error: {
            code: "BASELINE_UNAVAILABLE",
            message: "A compatible baseline is required for this export.",
          },
        },
        { status: 409 }
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: { code: "INVALID_EXPORT", message: "Review the Carrier Export fields." } },
        { status: 400 }
      );
    return NextResponse.json(
      {
        error: { code: "INTERNAL_SERVER_ERROR", message: "Carrier Export preview is unavailable." },
      },
      { status: 500 }
    );
  }
}
