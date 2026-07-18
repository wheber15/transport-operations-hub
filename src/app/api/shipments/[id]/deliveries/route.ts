import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  DeliveryAssignmentConflictError,
  DeliveryAssignmentForbiddenError,
  DeliveryNotFoundError,
  ShipmentNotFoundError,
  assignDeliveryToShipment,
} from "@/features/shipments/services/shipment-service";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/shipments/[id]/deliveries">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const body: unknown = await request.json();
    const { id } = await params;
    const result = await assignDeliveryToShipment(user, id, body);
    revalidatePath(`/shipments/${id}`);
    revalidatePath("/shipments");
    revalidatePath("/");
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

function assignmentErrorResponse(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError)
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid delivery assignment request." } },
      { status: 400 }
    );
  if (error instanceof DeliveryAssignmentForbiddenError)
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You are not allowed to manage delivery assignments.",
        },
      },
      { status: 403 }
    );
  if (error instanceof ShipmentNotFoundError || error instanceof DeliveryNotFoundError)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Shipment or delivery is unavailable." } },
      { status: 404 }
    );
  if (error instanceof DeliveryAssignmentConflictError)
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "The delivery assignment has changed. Refresh and try again.",
        },
      },
      { status: 409 }
    );
  return NextResponse.json(
    { error: { code: "INTERNAL_SERVER_ERROR", message: "Delivery assignment is unavailable." } },
    { status: 500 }
  );
}
