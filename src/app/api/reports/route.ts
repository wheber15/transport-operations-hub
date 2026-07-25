import { NextResponse } from "next/server";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  listReportHistory,
  ReportsAccessForbiddenError,
} from "@/features/reports/application/daily-orders-report-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }
  try {
    return NextResponse.json({ data: await listReportHistory(user) });
  } catch (error) {
    if (error instanceof ReportsAccessForbiddenError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to access Reports." } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Report history is unavailable." } },
      { status: 500 }
    );
  }
}
