import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import { OrderNotFoundError, getOrderById } from "@/features/orders/application/order-service";

export async function GET(_request: Request, { params }: RouteContext<"/api/orders/[id]">) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const order = await getOrderById(id);

    return NextResponse.json({ data: order });
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found." } },
        { status: 404 }
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "INVALID_ORDER_ID", message: "Invalid order identifier." } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Order details are unavailable." } },
      { status: 500 }
    );
  }
}
