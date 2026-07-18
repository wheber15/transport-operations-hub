import {
  Boxes,
  CalendarClock,
  ClipboardList,
  Clock3,
  PackageCheck,
  Truck,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { connection } from "next/server";

import { ActivityTimeline } from "@/components/shared/operations/activity-timeline";
import { DashboardGrid } from "@/components/shared/operations/dashboard-grid";
import { EmptyState } from "@/components/shared/operations/empty-state";
import { MetricCard } from "@/components/shared/operations/metric-card";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { SectionHeader } from "@/components/shared/operations/section-header";

const planningWindows = ["Morning", "Midday", "Afternoon"] as const;

function getGreeting(hour: number) {
  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default async function DashboardPage() {
  await connection();

  const currentDate = new Date();
  const currentDateLabel = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(
    currentDate
  );
  const greeting = getGreeting(currentDate.getHours());

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
      <header className="border-border/80 bg-card flex flex-col justify-between gap-5 rounded-xl border px-5 py-6 shadow-sm sm:flex-row sm:items-end sm:px-6">
        <div>
          <p className="text-primary text-sm font-medium">{greeting}</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Transport Operations Workspace
          </h1>
        </div>
        <time
          className="text-muted-foreground flex items-center gap-2 text-sm"
          dateTime={currentDate.toISOString()}
        >
          <CalendarClock aria-hidden="true" className="size-4" />
          {currentDateLabel}
        </time>
      </header>

      <OperationsPanel aria-label="Yesterday's Transport">
        <SectionHeader
          description="Outstanding work from yesterday"
          title="Yesterday's Transport"
        />
        <EmptyState
          description="Outstanding transport work will appear here when connected."
          icon={Clock3}
          title="No transport source connected"
        />
      </OperationsPanel>

      <OperationsPanel aria-label="Today's Planning">
        <SectionHeader description="Today's planning windows" title="Today's Planning" />
        <DashboardGrid className="p-4" columns="three">
          {planningWindows.map((window) => (
            <div className="border-border/80 rounded-lg border" key={window}>
              <div className="border-border/80 border-b px-4 py-3">
                <h3 className="text-foreground text-sm font-medium">{window}</h3>
              </div>
              <EmptyState
                description="Planning work will appear here when connected."
                icon={ClipboardList}
                title="No planning source connected"
              />
            </div>
          ))}
        </DashboardGrid>
      </OperationsPanel>

      <section aria-label="Today's Progress">
        <SectionHeader
          className="border-0 px-0 pt-0"
          description="Operational measures for today"
          title="Today's Progress"
        />
        <DashboardGrid className="mt-4" columns="four">
          <MetricCard description="No data connected" icon={Truck} label="Shipments" />
          <MetricCard description="No data connected" icon={PackageCheck} label="Deliveries" />
          <MetricCard description="No data connected" icon={Boxes} label="Estimated Pallets" />
          <MetricCard description="No data connected" icon={Boxes} label="Actual Pallets" />
        </DashboardGrid>
      </section>

      <DashboardGrid>
        <OperationsPanel aria-label="Outstanding Rep Items">
          <SectionHeader
            description="Open sales representative issues"
            title="Outstanding Rep Items"
          />
          <EmptyState
            description="Rep items will appear here when connected."
            icon={UsersRound}
            title="No rep items source connected"
          />
        </OperationsPanel>
        <OperationsPanel aria-label="Late Additions">
          <SectionHeader description="Changes received after planning" title="Late Additions" />
          <EmptyState
            description="Late additions will appear here when connected."
            icon={TriangleAlert}
            title="No late additions source connected"
          />
        </OperationsPanel>
      </DashboardGrid>

      <OperationsPanel aria-label="Recent Activity">
        <SectionHeader description="The latest operational updates" title="Recent Activity" />
        <ActivityTimeline />
      </OperationsPanel>
    </div>
  );
}
