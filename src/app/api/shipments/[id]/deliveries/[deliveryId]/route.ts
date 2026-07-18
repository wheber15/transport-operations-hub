import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  DeliveryAssignmentConflictError,
  DeliveryAssignmentForbiddenError,
  DeliveryNotFoundError,
  ShipmentNotFoundError,
  unassignDeliveryFromShipment,
} from "@/features/shipments/services/shipment-service";

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/shipments/[id]/deliveries/[deliveryId]">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id, deliveryId } = await params;
    const result = await unassignDeliveryFromShipment(user, { shipmentId: id, deliveryId });
    revalidatePath(`/shipments/${id}`);
    revalidatePath("/shipments");
    revalidatePath("/");
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof ZodError)
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
}
