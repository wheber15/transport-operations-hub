import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/features/auth/application/session";
import { deliveryImportErrorResponse } from "@/app/api/shipments/[id]/delivery-import/preview/route";
import { commitDeliveryImport } from "@/features/shipments/services/delivery-import-service";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/shipments/[id]/delivery-import/commit">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const result = await commitDeliveryImport(user, id, body);
    revalidatePath(`/shipments/${id}`);
    revalidatePath("/shipments");
    revalidatePath("/");
    return NextResponse.json({ data: result });
  } catch (error) {
    return deliveryImportErrorResponse(error);
  }
}
