import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  DeliveryImportForbiddenError,
  DeliveryImportShipmentNotFoundError,
  DeliveryImportValidationError,
  previewDeliveryImport,
} from "@/features/shipments/services/delivery-import-service";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/shipments/[id]/delivery-import/preview">
) {
  const user = await getCurrentUser();
  if (!user) return unauthenticatedResponse();

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    return NextResponse.json({ data: await previewDeliveryImport(user, id, body) });
  } catch (error) {
    return deliveryImportErrorResponse(error);
  }
}

function unauthenticatedResponse() {
  return NextResponse.json(
    { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
    { status: 401 }
  );
}

export function deliveryImportErrorResponse(error: unknown) {
  if (
    error instanceof ZodError ||
    error instanceof SyntaxError ||
    error instanceof DeliveryImportValidationError
  )
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid delivery import request." } },
      { status: 400 }
    );
  if (error instanceof DeliveryImportForbiddenError)
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not allowed to import deliveries." } },
      { status: 403 }
    );
  if (error instanceof DeliveryImportShipmentNotFoundError)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Shipment is unavailable." } },
      { status: 404 }
    );
  return NextResponse.json(
    { error: { code: "INTERNAL_SERVER_ERROR", message: "Delivery import is unavailable." } },
    { status: 500 }
  );
}
