import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  PalletDeliveryNotFoundError,
  PalletForbiddenError,
  getPalletWorkspace,
  clearPalletSet,
  savePalletSet,
} from "@/features/orders/application/pallet-service";

function errorResponse(error: unknown) {
  if (error instanceof PalletForbiddenError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not allowed to manage pallets." } },
      { status: 403 }
    );
  }
  if (error instanceof PalletDeliveryNotFoundError) {
    return NextResponse.json(
      { error: { code: "DELIVERY_NOT_FOUND", message: "Delivery not found." } },
      { status: 404 }
    );
  }
  if (error instanceof ZodError) {
    const fieldErrors = Object.fromEntries(
      error.issues.flatMap((issue) => {
        const path = issue.path.join(".");
        return path ? [[path, issue.message]] : [];
      })
    );
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PALLET_WEIGHT",
          message: "Review the highlighted pallet weights and sequence numbers.",
          fieldErrors,
        },
      },
      { status: 400 }
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "The pallet request could not be read. Try again.",
        },
      },
      { status: 400 }
    );
  }
  if (error instanceof Error && error.message === "STALE_RECORD") {
    return NextResponse.json(
      {
        error: {
          code: "STALE_RECORD",
          message: "This Delivery changed before the pallets were saved.",
        },
      },
      { status: 409 }
    );
  }
  if (error instanceof Error && error.message === "PALLET_NOT_FOUND") {
    return NextResponse.json(
      { error: { code: "PALLET_NOT_FOUND", message: "A pallet is no longer available." } },
      { status: 404 }
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "The pallets could not be saved." } },
    { status: 500 }
  );
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/deliveries/[id]/pallets">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id } = await params;
    return NextResponse.json({ data: await getPalletWorkspace(user, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: RouteContext<"/api/deliveries/[id]/pallets">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id } = await params;
    if (process.env.NODE_ENV === "development")
      console.info("pallet-save route entered", { deliveryId: id });
    return NextResponse.json({ data: await savePalletSet(user, id, await request.json()) });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("pallet-save route failed", {
        code: error instanceof Error ? error.message : "UNKNOWN",
      });
    }
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/deliveries/[id]/pallets">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id } = await params;
    return NextResponse.json({ data: await clearPalletSet(user, id, await request.json()) });
  } catch (error) {
    return errorResponse(error);
  }
}
