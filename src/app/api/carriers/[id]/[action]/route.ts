import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/application/session";
import {
  CarrierForbiddenError,
  CarrierNotFoundError,
  setCarrierActive,
} from "@/features/carriers/services/carrier-service";
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/carriers/[id]/[action]">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  const { id, action } = await params;
  if (action !== "deactivate" && action !== "activate")
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Carrier action was not found." } },
      { status: 404 }
    );
  try {
    await setCarrierActive(user, id, action === "activate");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof CarrierForbiddenError)
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You are not allowed to change Carrier status." } },
        { status: 403 }
      );
    if (error instanceof CarrierNotFoundError)
      return NextResponse.json(
        { error: { code: "CARRIER_NOT_FOUND", message: "Carrier was not found." } },
        { status: 404 }
      );
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Carrier status could not be updated." } },
      { status: 500 }
    );
  }
}
