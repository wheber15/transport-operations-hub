import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  OrderAdministrationForbiddenError,
  OrderNotFoundError,
  deleteOrder,
  getOrderById,
  updateOrder,
} from "@/features/orders/application/order-service";

function mutationErrorResponse(error: unknown) {
  if (error instanceof OrderAdministrationForbiddenError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You do not have permission to manage Orders." } },
      { status: 403 }
    );
  }
  if (error instanceof OrderNotFoundError) {
    return NextResponse.json(
      { error: { code: "ORDER_NOT_FOUND", message: "Order not found or no longer active." } },
      { status: 404 }
    );
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json(
      { error: { code: "INVALID_ORDER", message: "Review the highlighted Order fields." } },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_SERVER_ERROR", message: "The Order could not be saved." } },
    { status: 500 }
  );
}

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

export async function PATCH(request: Request, { params }: RouteContext<"/api/orders/[id]">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }
  try {
    const { id } = await params;
    return NextResponse.json({ data: await updateOrder(user, id, await request.json()) });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/orders/[id]">) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }
  try {
    const { id } = await params;
    await deleteOrder(user, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
