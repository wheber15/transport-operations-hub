import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  CarrierDuplicateError,
  CarrierForbiddenError,
  createCarrier,
  getCarriers,
} from "@/features/carriers/services/carrier-service";

function unauthenticated() {
  return NextResponse.json(
    { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
    { status: 401 }
  );
}
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();
  try {
    const result = await getCarriers(user, Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json({
      data: result.items,
      summary: result.summary,
      filters: result.filters,
    });
  } catch (error) {
    if (error instanceof CarrierForbiddenError)
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not allowed to view these Carriers." } },
        { status: 403 }
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: { code: "INVALID_QUERY", message: "Review the Carrier filters." } },
        { status: 400 }
      );
    console.error("carrier_list_failed", {
      operation: "listCarriers",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Carriers are unavailable." } },
      { status: 500 }
    );
  }
}
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthenticated();
  try {
    return NextResponse.json(
      { data: await createCarrier(user, await request.json()) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof CarrierForbiddenError)
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not allowed to create Carriers." } },
        { status: 403 }
      );
    if (error instanceof CarrierDuplicateError)
      return NextResponse.json(
        { error: { code: "CARRIER_ALREADY_EXISTS", message: "Carrier number already exists." } },
        { status: 409 }
      );
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: { code: "INVALID_PAYLOAD", message: "Review the Carrier fields." } },
        { status: 400 }
      );
    console.error("carrier_create_failed", {
      operation: "createCarrier",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Carrier could not be created." } },
      { status: 500 }
    );
  }
}
