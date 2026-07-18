import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  ShipmentNotFoundError,
  getShipmentById,
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

    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Shipment details are unavailable." } },
      { status: 500 }
    );
  }
}
