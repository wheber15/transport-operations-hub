import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  CarrierDuplicateError,
  CarrierForbiddenError,
  CarrierNotFoundError,
  updateCarrier,
} from "@/features/carriers/services/carrier-service";
export async function PATCH(request: Request, { params }: RouteContext<"/api/carriers/[id]">) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id } = await params;
    await updateCarrier(user, id, await request.json());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof CarrierForbiddenError)
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not allowed to edit Carriers." } },
        { status: 403 }
      );
    if (error instanceof CarrierDuplicateError)
      return NextResponse.json(
        { error: { code: "CARRIER_ALREADY_EXISTS", message: "Carrier number already exists." } },
        { status: 409 }
      );
    if (error instanceof CarrierNotFoundError)
      return NextResponse.json(
        { error: { code: "CARRIER_NOT_FOUND", message: "Carrier was not found." } },
        { status: 404 }
      );
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: { code: "INVALID_PAYLOAD", message: "Review the Carrier fields." } },
        { status: 400 }
      );
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Carrier could not be updated." } },
      { status: 500 }
    );
  }
}
