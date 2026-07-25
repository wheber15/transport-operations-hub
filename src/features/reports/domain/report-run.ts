export const dailyOrdersDatasetVersion = "1.0";
export const dailyOrdersSnapshotSchemaVersion = "1.0";
export const maximumDailyOrdersSnapshotRows = 5_000;

export type ReportRunStatus = "PENDING" | "GENERATING" | "COMPLETED" | "FAILED";

const allowedTransitions: Readonly<Record<ReportRunStatus, readonly ReportRunStatus[]>> = {
  PENDING: ["GENERATING", "FAILED"],
  GENERATING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
};

export function canTransitionReportRun(from: ReportRunStatus, to: ReportRunStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertReportRunTransition(from: ReportRunStatus, to: ReportRunStatus) {
  if (!canTransitionReportRun(from, to)) {
    throw new Error(`Invalid report lifecycle transition: ${from} to ${to}.`);
  }
}

export function formatDailyOrdersReference(businessDate: string, sequence: number) {
  return `AXR-ORD-${businessDate.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`;
}

export type CanonicalReportFilter = {
  reportType: "DAILY_ORDERS";
  datePreset: "today" | "tomorrow" | "yesterday" | "thisWeek" | "custom";
  scopeStartDate: string | null;
  scopeEndDate: string | null;
  query: string | null;
  customer: string | null;
  route: string | null;
  shipTo: string | null;
  carrier: string | null;
  shipmentState: "all" | "assigned" | "unassigned";
  palletState: "all" | "awaiting" | "captured";
  recordState: "active" | "deleted" | "all";
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(Reflect.get(value, key))}`)
    .join(",")}}`;
}
