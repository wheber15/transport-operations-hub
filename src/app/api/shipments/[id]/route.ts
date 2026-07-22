import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  DeliveryAssignmentForbiddenError,
  ShipmentClosedError,
  ShipmentDuplicateError,
  ShipmentCarrierUnavailableError,
  ShipmentNotFoundError,
  getShipmentById,
  updateOpenShipment,
} from "@/features/shipments/services/shipment-service";

export async function GET(_request: Request, { params }: RouteContext<"/api/shipments/[id]">) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const shipment = await getShipmentById(id);

    return NextResponse.json({ data: shipment });
  } catch (error) {
    if (error instanceof ShipmentNotFoundError) {
      return NextResponse.json(
        { error: { code: "SHIPMENT_NOT_FOUND", message: "Shipment not found." } },
        { status: 404 }
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "INVALID_SHIPMENT_ID", message: "Invalid shipment identifier." } },
        { status: 400 }
      );
    }

    console.error("shipment_detail_failed", {
      operation: "getShipmentById",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Shipment details are unavailable." } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/shipments/[id]">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    await updateOpenShipment(user, id, await request.json());
    return NextResponse.json({ data: await getShipmentById(id) });
  } catch (error) {
    if (error instanceof ShipmentDuplicateError) {
      return NextResponse.json(
        { error: { code: "SHIPMENT_ALREADY_EXISTS", message: "Shipment number already exists." } },
        { status: 409 }
      );
    }
    if (error instanceof ShipmentCarrierUnavailableError) {
      return NextResponse.json(
        { error: { code: "INVALID_CARRIER", message: "Select an active Carrier." } },
        { status: 400 }
      );
    }
    if (error instanceof ShipmentClosedError) {
      return NextResponse.json(
        { error: { code: "SHIPMENT_CLOSED", message: "Closed Shipments cannot be edited." } },
        { status: 409 }
      );
    }
    if (error instanceof DeliveryAssignmentForbiddenError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not allowed to edit Shipments." } },
        { status: 403 }
      );
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "INVALID_PAYLOAD", message: "Review the Shipment fields." } },
        { status: 400 }
      );
    }
    console.error("shipment_update_failed", {
      operation: "updateShipment",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Shipment could not be updated." } },
      { status: 500 }
    );
  }
}
