import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "@/features/auth/application/session";
import {
  generateDailyOrdersXlsx,
  getReportArtifactForDownload,
  ReportsAccessForbiddenError,
  ReportXlsxFailedError,
  ReportXlsxUnavailableError,
  deleteReport,
  ReportDeleteForbiddenError,
  ReportDeleteUnavailableError,
} from "@/features/reports/application/daily-orders-report-service";
import { getLocalReportArtifactStorage } from "@/features/reports/infrastructure/local-report-artifact-storage";
import { recordArtifactDownload } from "@/features/reports/infrastructure/report-run-repository";
import {
  reportArtifactFormatSchema,
  reportRunIdSchema,
} from "@/features/reports/validation/report-run-schemas";

export const runtime = "nodejs";

function contentDisposition(fileName: string) {
  return `attachment; filename="${fileName.replace(/[\\/\r\n"]/g, "_")}"`;
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/reports/[id]/artifacts/[format]">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id, format } = await context.params;
    if (format !== "XLSX")
      return NextResponse.json(
        { error: { code: "INVALID_ARTIFACT", message: "The report request is invalid." } },
        { status: 400 }
      );
    const deleted = await deleteReport(user, reportRunIdSchema.parse(id));
    if (!deleted)
      return NextResponse.json(
        { error: { code: "REPORT_NOT_FOUND", message: "This report is not available." } },
        { status: 404 }
      );
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    if (error instanceof ReportDeleteForbiddenError)
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete reports." } },
        { status: 403 }
      );
    if (error instanceof ReportDeleteUnavailableError)
      return NextResponse.json(
        {
          error: {
            code: "REPORT_GENERATING",
            message: "A report cannot be deleted while it is being generated.",
          },
        },
        { status: 409 }
      );
    return NextResponse.json(
      {
        error: { code: "REPORT_DELETE_FAILED", message: "The report could not be deleted safely." },
      },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/reports/[id]/artifacts/[format]">
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  }
  try {
    const { id, format } = await context.params;
    const artifact = await getReportArtifactForDownload(
      user,
      reportRunIdSchema.parse(id),
      reportArtifactFormatSchema.parse(format)
    );
    if (!artifact) {
      return NextResponse.json(
        {
          error: {
            code: "ARTIFACT_NOT_AVAILABLE",
            message: "This report artifact is not available.",
          },
        },
        { status: 404 }
      );
    }
    const storage = getLocalReportArtifactStorage();
    const stored = await storage.open({
      storageKey: artifact.storageKey,
      checksumSha256: artifact.checksumSha256,
    });
    if (!stored || stored.byteSize !== artifact.byteSize) {
      return NextResponse.json(
        {
          error: {
            code: "ARTIFACT_NOT_AVAILABLE",
            message: "This report artifact is not available.",
          },
        },
        { status: 404 }
      );
    }
    await recordArtifactDownload(artifact.reportRun.id, user.id, artifact.format);
    return new NextResponse(stored.stream, {
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": contentDisposition(artifact.fileName),
        "Content-Length": artifact.byteSize.toString(),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "INVALID_ARTIFACT", message: "The report artifact request is invalid." } },
        { status: 400 }
      );
    }
    if (error instanceof ReportsAccessForbiddenError) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to download report artifacts.",
          },
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "The report artifact is unavailable." } },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  context: RouteContext<"/api/reports/[id]/artifacts/[format]">
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication is required." } },
      { status: 401 }
    );
  try {
    const { id, format } = await context.params;
    const artifactFormat = reportArtifactFormatSchema.parse(format);
    if (artifactFormat !== "XLSX")
      return NextResponse.json(
        {
          error: {
            code: "ARTIFACT_NOT_SUPPORTED",
            message: "This report format is not available.",
          },
        },
        { status: 422 }
      );
    const result = await generateDailyOrdersXlsx(user, reportRunIdSchema.parse(id));
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: { code: "INVALID_ARTIFACT", message: "The Excel report request is invalid." } },
        { status: 400 }
      );
    if (error instanceof ReportsAccessForbiddenError)
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to generate Excel reports.",
          },
        },
        { status: 403 }
      );
    if (error instanceof ReportXlsxUnavailableError)
      return NextResponse.json(
        {
          error: {
            code:
              error.reason === "IN_PROGRESS" ? "REPORT_XLSX_GENERATING" : "REPORT_XLSX_UNAVAILABLE",
            message:
              error.reason === "IN_PROGRESS"
                ? "This Excel report is already being generated."
                : "This Excel report cannot be generated from this report record.",
          },
        },
        { status: error.reason === "IN_PROGRESS" ? 409 : 422 }
      );
    if (error instanceof ReportXlsxFailedError)
      return NextResponse.json(
        {
          error: {
            code: "REPORT_XLSX_GENERATION_FAILED",
            message: "The Excel report could not be generated.",
          },
        },
        { status: 500 }
      );
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "The Excel report is unavailable." } },
      { status: 500 }
    );
  }
}
