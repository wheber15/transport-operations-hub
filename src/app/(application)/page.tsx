import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { DashboardWorkspace } from "@/features/dashboard/components/dashboard-workspace";
import { getDashboard } from "@/features/dashboard/services/dashboard-service";
import { getOperationalHour, getOperationalTimeZone } from "@/server/config/operational-timezone";

export const metadata: Metadata = {
  title: "Dashboard",
};

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
  const [data, operationalHour, operationalTimeZone] = await Promise.all([
    getDashboard(),
    getOperationalHour(currentDate),
    getOperationalTimeZone(),
  ]);
  const currentDateLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: operationalTimeZone,
  }).format(currentDate);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
      <header className="border-border/80 bg-card flex flex-col justify-between gap-5 rounded-xl border px-5 py-6 shadow-sm sm:flex-row sm:items-end sm:px-6">
        <div>
          <p className="text-primary text-sm font-medium">{getGreeting(operationalHour)}</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Transport Operations Workspace
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            What needs your attention right now.
          </p>
        </div>
        <time
          className="text-muted-foreground flex items-center gap-2 text-sm"
          dateTime={currentDate.toISOString()}
        >
          <CalendarClock aria-hidden="true" className="size-4" />
          {currentDateLabel}
        </time>
      </header>

      <DashboardWorkspace data={data} />
    </div>
  );
}
