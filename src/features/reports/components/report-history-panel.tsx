import Link from "next/link";

import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { formatIrelandDateTime } from "@/lib/business-date";
import type { ReportHistoryItem } from "@/features/reports/infrastructure/report-run-repository";
import { GenerateExcelReportButton } from "@/features/reports/components/generate-excel-report-button";
import { DeleteReportButton } from "@/features/reports/components/delete-report-button";

type ReportHistoryPanelProps = {
  isAdministrator: boolean;
  runs: Array<
    ReportHistoryItem & {
      failureCode: string | null;
      failureMessage: string | null;
    }
  >;
};

export function ReportHistoryPanel({ runs, isAdministrator }: ReportHistoryPanelProps) {
  return (
    <OperationsPanel aria-label="Report history">
      <div className="border-border/80 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Report history</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Generate a daily report, then create and download its Excel version when needed.
          </p>
        </div>
      </div>
      {runs.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="text-muted-foreground bg-muted/30 text-xs uppercase">
              <tr>
                {[
                  "Reference",
                  "Scope",
                  "Status",
                  "Rows",
                  "Exceptions",
                  "Requested by",
                  "Created",
                  "Excel",
                  ...(isAdministrator ? ["Actions"] : []),
                ].map((heading) => (
                  <th className="px-4 py-3 font-medium" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border/80 divide-y">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3 font-medium">{run.reference}</td>
                  <td className="px-4 py-3">
                    {run.scopeStartDate.toISOString().slice(0, 10)} to{" "}
                    {run.scopeEndDate.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                      {run.status}
                    </span>
                    {run.failureMessage ? (
                      <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                        {run.failureMessage}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{run.rowCount.toLocaleString("en-IE")}</td>
                  <td className="px-4 py-3">{run.exceptionCount.toLocaleString("en-IE")}</td>
                  <td className="px-4 py-3">
                    {run.requestedByDisplayName} / {run.requestedByRole}
                  </td>
                  <td className="px-4 py-3">{formatIrelandDateTime(run.createdAt)}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const excel = run.artifacts.find((artifact) => artifact.format === "XLSX");
                      if (!excel) return <GenerateExcelReportButton reportRunId={run.id} />;
                      if (excel.status === "COMPLETED" && excel.fileName)
                        return (
                          <Link
                            className="text-primary hover:underline"
                            href={`/api/reports/${run.id}/artifacts/XLSX`}
                          >
                            Download Excel
                          </Link>
                        );
                      return (
                        <span className="text-muted-foreground">
                          Excel: {excel.status === "GENERATING" ? "Generating" : excel.status}
                        </span>
                      );
                    })()}
                  </td>
                  {isAdministrator ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-muted-foreground text-xs">Regenerate Report</span>
                        <DeleteReportButton reportRunId={run.id} />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground px-5 py-8 text-sm">
          No Daily Orders reports have been created yet.
        </p>
      )}
    </OperationsPanel>
  );
}
