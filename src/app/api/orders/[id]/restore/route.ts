import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  OrderAdministrationForbiddenError,
  OrderNotFoundError,
  restoreOrder,
} from "@/features/orders/application/order-service";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/orders/[id]/restore">
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }
  try {
    const { id } = await params;
    await restoreOrder(user, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof OrderAdministrationForbiddenError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to restore Orders." } },
        { status: 403 }
      );
    }
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Deleted Order not found." } },
        { status: 404 }
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "INVALID_ORDER_ID", message: "Invalid Order identifier." } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "The Order could not be restored." } },
      { status: 500 }
    );
  }
}
