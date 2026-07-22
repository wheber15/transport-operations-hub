import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  DeliveryAssignmentForbiddenError,
  ShipmentMovementNotFoundError,
  updateShipmentMovement,
} from "@/features/shipments/services/shipment-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    await updateShipmentMovement(user, id, await request.json());
    return NextResponse.json({ data: { shipmentId: id } });
  } catch (error) {
    if (error instanceof ShipmentMovementNotFoundError) {
      return NextResponse.json(
        { error: { code: "SHIPMENT_NOT_FOUND", message: "Shipment not found." } },
        { status: 404 }
      );
    }
    if (error instanceof DeliveryAssignmentForbiddenError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not allowed to update movement times." } },
        { status: 403 }
      );
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_MOVEMENT_TIMES",
            message: "Review the operational movement times.",
            fieldErrors: error instanceof ZodError ? error.flatten().fieldErrors : undefined,
          },
        },
        { status: 400 }
      );
    }
    console.error("shipment_movement_update_failed", {
      operation: "updateShipmentMovement",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Movement times could not be saved." } },
      { status: 500 }
    );
  }
}
