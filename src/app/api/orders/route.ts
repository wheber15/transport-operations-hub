import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import { listOrders } from "@/features/orders/application/order-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }

  try {
    const filters = Object.fromEntries(request.nextUrl.searchParams);
    const result = await listOrders(filters);

    return NextResponse.json({
      data: result.items,
      meta: {
        page: result.filters.page,
        pageSize: result.filters.pageSize,
        total: result.total,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "INVALID_QUERY", message: "Invalid order query parameters." } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Orders are unavailable." } },
      { status: 500 }
    );
  }
}
