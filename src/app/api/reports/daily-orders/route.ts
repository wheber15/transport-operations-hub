import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  createDailyOrdersReportSnapshot,
  ReportDatasetTooLargeError,
  ReportRecordStateForbiddenError,
  ReportsAccessForbiddenError,
  ReportScopeRequiredError,
  ReportSnapshotFailedError,
} from "@/features/reports/application/daily-orders-report-service";
import { createDailyOrdersReportSchema } from "@/features/reports/validation/report-run-schemas";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }
  try {
    const payload = createDailyOrdersReportSchema.parse(await request.json());
    const result = await createDailyOrdersReportSnapshot(payload.filters, user);
    return NextResponse.json(
      { data: result.run, meta: { duplicate: result.duplicate } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError || error instanceof ReportScopeRequiredError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REPORT_SCOPE",
            message: "A complete valid report scope is required.",
          },
        },
        { status: 400 }
      );
    }
    if (
      error instanceof ReportsAccessForbiddenError ||
      error instanceof ReportRecordStateForbiddenError
    ) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to create this report.",
          },
        },
        { status: 403 }
      );
    }
    if (error instanceof ReportDatasetTooLargeError) {
      return NextResponse.json(
        {
          error: {
            code: "REPORT_DATASET_TOO_LARGE",
            message: "This report exceeds the current safe size limit.",
          },
        },
        { status: 422 }
      );
    }
    if (error instanceof ReportSnapshotFailedError) {
      return NextResponse.json(
        {
          error: {
            code: "REPORT_SNAPSHOT_FAILED",
            message: "The report snapshot could not be completed.",
          },
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "The report could not be created." } },
      { status: 500 }
    );
  }
}
