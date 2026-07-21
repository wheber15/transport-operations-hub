import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  DeliveryAssignmentForbiddenError,
  ShipmentClosedError,
  ShipmentEmptyError,
  closeShipment,
} from "@/features/shipments/services/shipment-service";
import { ZodError } from "zod";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/shipments/[id]/close">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id } = await params;
    await closeShipment(user, id, await request.json());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ShipmentEmptyError)
      return NextResponse.json(
        {
          error: {
            code: "EMPTY_CONFIRMATION_REQUIRED",
            message: "Confirm closing this empty Shipment.",
          },
        },
        { status: 409 }
      );
    if (error instanceof ShipmentClosedError)
      return NextResponse.json(
        {
          error: { code: "SHIPMENT_CLOSED", message: "Shipment is already closed or unavailable." },
        },
        { status: 409 }
      );
    if (error instanceof DeliveryAssignmentForbiddenError)
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not allowed to close this Shipment." } },
        { status: 403 }
      );
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: { code: "INVALID_PAYLOAD", message: "Review the close confirmation." } },
        { status: 400 }
      );
    console.error("shipment_close_failed", {
      operation: "closeShipment",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Shipment could not be closed." } },
      { status: 500 }
    );
  }
}
