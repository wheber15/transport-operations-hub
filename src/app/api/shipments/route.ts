import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import { listShipments } from "@/features/shipments/services/shipment-service";

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
    const result = await listShipments(filters);

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
        { error: { code: "INVALID_QUERY", message: "Invalid shipment query parameters." } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Shipments are unavailable." } },
      { status: 500 }
    );
  }
}
