import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  DeliveryAssignmentForbiddenError,
  ShipmentDuplicateError,
  ShipmentCarrierUnavailableError,
  createShipment,
  listShipments,
} from "@/features/shipments/services/shipment-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const filters = {
      ...Object.fromEntries(request.nextUrl.searchParams),
      query:
        request.nextUrl.searchParams.get("q") ??
        request.nextUrl.searchParams.get("query") ??
        undefined,
    };
    const result = await listShipments(filters);
    return NextResponse.json({
      data: result.items,
      meta: { page: result.filters.page, pageSize: result.filters.pageSize, total: result.total },
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: { code: "INVALID_QUERY", message: "Invalid shipment query parameters." } },
        { status: 400 }
      );
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Shipments are unavailable." } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    return NextResponse.json(
      { data: await createShipment(user, await request.json()) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ShipmentDuplicateError)
      return NextResponse.json(
        { error: { code: "SHIPMENT_ALREADY_EXISTS", message: "Shipment number already exists." } },
        { status: 409 }
      );
    if (error instanceof ShipmentCarrierUnavailableError)
      return NextResponse.json(
        { error: { code: "INVALID_CARRIER", message: "Select an active Carrier." } },
        { status: 400 }
      );
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: { code: "INVALID_PAYLOAD", message: "Review the Shipment fields." } },
        { status: 400 }
      );
    if (error instanceof DeliveryAssignmentForbiddenError)
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not allowed to create Shipments." } },
        { status: 403 }
      );
    console.error("shipment_create_failed", {
      operation: "createShipment",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Shipment could not be created." } },
      { status: 500 }
    );
  }
}
