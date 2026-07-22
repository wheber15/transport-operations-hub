import { NextResponse } from "next/server";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  getOrdersLeftForToday,
  ordersLeftFilename,
} from "@/features/orders/application/orders-left-service";
import { createOrdersLeftWorkbook } from "@/features/orders/lib/orders-left-workbook";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const rows = await getOrdersLeftForToday();
    if (!rows.length)
      return NextResponse.json({ data: null, message: "No orders are left for today." });
    const workbook = await createOrdersLeftWorkbook(rows);
    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ordersLeftFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("orders_left_export_failed", {
      operation: "ordersLeftExport",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Orders left workbook could not be generated.",
        },
      },
      { status: 500 }
    );
  }
}
