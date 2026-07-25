import { FileBarChart, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/features/auth/application/session";
import { DailyOrdersReportPreview } from "@/features/reports/components/daily-orders-report-preview";
import { CreateDailyOrdersSnapshotButton } from "@/features/reports/components/create-daily-orders-snapshot-button";
import { ReportHistoryPanel } from "@/features/reports/components/report-history-panel";
import {
  getDailyOrdersReport,
  getValidatedDailyOrdersReportFilters,
  listReportHistory,
} from "@/features/reports/application/daily-orders-report-service";

type ReportsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
type ReportFilters = ReturnType<typeof getValidatedDailyOrdersReportFilters>;

function reportHref(filters: ReportFilters, overrides: Partial<ReportFilters> = {}) {
  const nextFilters = { ...filters, ...overrides };
  const params = new URLSearchParams({
    datePreset: nextFilters.datePreset,
    page: String(nextFilters.page),
    pageSize: String(nextFilters.pageSize),
  });
  for (const [key, value] of Object.entries({
    from: nextFilters.datePreset === "custom" ? nextFilters.from : undefined,
    to: nextFilters.datePreset === "custom" ? nextFilters.to : undefined,
    query: nextFilters.query,
    customer: nextFilters.customer,
    route: nextFilters.route,
    shipTo: nextFilters.shipTo,
    carrier: nextFilters.carrier,
    shipmentState: nextFilters.shipmentState,
    palletState: nextFilters.palletState,
    recordState: nextFilters.recordState,
  }))
    if (value && !["all", "active"].includes(value)) params.set(key, value);
  return `/reports?${params}`;
}

function presetHref(
  filters: ReportFilters,
  preset: "today" | "tomorrow" | "yesterday" | "thisWeek" | "custom"
) {
  return reportHref(filters, {
    datePreset: preset,
    from: preset === "custom" ? filters.from : undefined,
    to: preset === "custom" ? filters.to : undefined,
    page: 1,
  });
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await requireAuthenticatedUser();
  const raw = await searchParams;
  const filters = getValidatedDailyOrdersReportFilters({
    datePreset: first(raw.datePreset),
    from: first(raw.from),
    to: first(raw.to),
    query: first(raw.query),
    page: first(raw.page),
    pageSize: first(raw.pageSize),
    customer: first(raw.customer),
    route: first(raw.route),
    shipTo: first(raw.shipTo),
    carrier: first(raw.carrier),
    shipmentState: first(raw.shipmentState),
    palletState: first(raw.palletState),
    recordState: first(raw.recordState),
  });
  const [report, reportHistory] = await Promise.all([
    getDailyOrdersReport(filters, user),
    listReportHistory(user),
  ]);
  const upcomingReports = [
    "Daily Shipments",
    "Trailer Planning",
    "Pallet Summary",
    "Planned vs Actual Weight",
    "Pallet Accuracy",
    "Carrier Performance",
    "Weekly Operations",
    "Monthly Operations",
    "KPI Summary",
  ];
  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5 lg:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-medium">AXon</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Daily Orders Reporting
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Generate, download, and manage immutable Daily Orders report snapshots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CreateDailyOrdersSnapshotButton filters={filters} />
          <div className="text-muted-foreground text-sm">Signed in as {user.displayName}</div>
        </div>
      </header>
      <section className="grid gap-3 md:grid-cols-3" aria-label="Available reports">
        <div className="border-primary/30 bg-primary/5 rounded-xl border p-4">
          <FileBarChart className="text-primary size-5" />
          <h2 className="mt-3 font-semibold">Daily Orders</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Live operational preview available below.
          </p>
        </div>
      </section>
      <section aria-labelledby="upcoming-reports-heading">
        <div className="mb-3">
          <h2 className="text-base font-semibold" id="upcoming-reports-heading">
            Additional reports
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            These report types are not available in this release.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {upcomingReports.map((name) => (
            <article
              className="border-border/70 bg-muted/30 rounded-xl border p-4 opacity-75"
              data-availability="coming-soon"
              key={name}
            >
              <div className="flex items-start justify-between gap-3">
                <FileSpreadsheet className="text-muted-foreground size-5" />
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                  Coming Soon
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{name}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Not available in the current reporting release.
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="flex flex-wrap gap-2" aria-label="Daily Orders date presets">
        {(
          [
            ["today", "Today"],
            ["tomorrow", "Tomorrow"],
            ["yesterday", "Yesterday"],
            ["thisWeek", "This Week"],
            ["custom", "Custom"],
          ] as const
        ).map(([preset, label]) => (
          <Button
            key={preset}
            nativeButton={false}
            render={<Link href={presetHref(filters, preset)} />}
            size="sm"
            variant={filters.datePreset === preset ? "default" : "outline"}
          >
            {label}
          </Button>
        ))}
      </section>
      <div className="border-border/70 bg-card rounded-xl border p-4 text-sm">
        <form action="/reports" className="flex flex-wrap gap-2">
          <input name="datePreset" type="hidden" value={filters.datePreset} />
          <input name="page" type="hidden" value="1" />
          <input name="pageSize" type="hidden" value={filters.pageSize} />
          <input
            className="border-input h-9 rounded-md border px-3"
            defaultValue={filters.query}
            name="query"
            placeholder="Search Orders, Deliveries, Customers"
          />
          <input
            className="border-input h-9 rounded-md border px-3"
            defaultValue={filters.customer}
            name="customer"
            placeholder="Customer"
          />
          <input
            className="border-input h-9 rounded-md border px-3"
            defaultValue={filters.route}
            name="route"
            placeholder="Route"
          />
          <input
            className="border-input h-9 rounded-md border px-3"
            defaultValue={filters.shipTo}
            name="shipTo"
            placeholder="Ship-To"
          />
          <input
            className="border-input h-9 rounded-md border px-3"
            defaultValue={filters.carrier}
            name="carrier"
            placeholder="Carrier"
          />
          <select
            className="border-input h-9 rounded-md border px-3"
            defaultValue={filters.shipmentState}
            name="shipmentState"
          >
            <option value="all">All assignment states</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Awaiting Shipment</option>
          </select>
          {filters.datePreset === "custom" ? (
            <>
              <label className="sr-only" htmlFor="reports-from">
                Goods Issue date from
              </label>
              <input
                className="border-input h-9 rounded-md border px-3"
                defaultValue={filters.from}
                id="reports-from"
                name="from"
                type="date"
              />
              <label className="sr-only" htmlFor="reports-to">
                Goods Issue date to
              </label>
              <input
                className="border-input h-9 rounded-md border px-3"
                defaultValue={filters.to}
                id="reports-to"
                name="to"
                type="date"
              />
            </>
          ) : null}
          {user.role === "Administrator" ? (
            <select
              className="border-input h-9 rounded-md border px-3"
              defaultValue={filters.recordState}
              name="recordState"
            >
              <option value="active">Active records</option>
              <option value="deleted">Deleted records</option>
              <option value="all">All records</option>
            </select>
          ) : null}
          <select
            className="border-input h-9 rounded-md border px-3"
            defaultValue={filters.palletState}
            name="palletState"
          >
            <option value="all">All pallet states</option>
            <option value="awaiting">Awaiting pallet data</option>
            <option value="captured">Pallet data captured</option>
          </select>
          <Button type="submit" variant="outline">
            Apply filters
          </Button>
        </form>
      </div>
      <DailyOrdersReportPreview
        exceptions={report.exceptions}
        kpis={report.kpis}
        rows={report.rows}
        trailerPlanning={report.trailerPlanning}
      />
      <ReportHistoryPanel runs={reportHistory} isAdministrator={user.role === "Administrator"} />
      {report.totalRows > 0 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Report pagination">
          <p className="text-muted-foreground text-sm">
            Showing {(filters.page - 1) * filters.pageSize + 1}–
            {Math.min(filters.page * filters.pageSize, report.totalRows)} of {report.totalRows}{" "}
            Deliveries
          </p>
          <div className="flex gap-2">
            <Button
              disabled={filters.page === 1}
              nativeButton={false}
              render={<Link href={reportHref(filters, { page: Math.max(1, filters.page - 1) })} />}
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={filters.page * filters.pageSize >= report.totalRows}
              nativeButton={false}
              render={<Link href={reportHref(filters, { page: filters.page + 1 })} />}
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
