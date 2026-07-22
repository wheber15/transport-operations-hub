import { Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { Button } from "@/components/ui/button";
import { CreateShipmentDialog } from "@/features/shipments/components/create-shipment-dialog";
import { ShipmentsFilters } from "@/features/shipments/components/shipments-filters";
import { ShipmentsLiveSearch } from "@/features/shipments/components/shipments-live-search";
import { ShipmentsTable } from "@/features/shipments/components/shipments-table";
import { formatOperationalWeight } from "@/features/shipments/lib/date-formatting";
import { shipmentHref } from "@/features/shipments/lib/shipment-url-state";
import {
  getShipmentsSummary,
  getValidatedShipmentFilters,
  listActiveCarriers,
  listCarriersForShipmentFilters,
  listShipments,
} from "@/features/shipments/services/shipment-service";

export const metadata: Metadata = { title: "Shipments" };

type ShipmentsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShipmentsPage({ searchParams }: ShipmentsPageProps) {
  const raw = await searchParams;
  const filters = getValidatedShipmentFilters({
    query: first(raw.q) ?? first(raw.query),
    page: first(raw.page),
    pageSize: first(raw.pageSize),
    sortBy: first(raw.sortBy),
    sortDirection: first(raw.sortDirection),
    datePreset: first(raw.datePreset),
    dispatchFrom: first(raw.dispatchFrom),
    dispatchTo: first(raw.dispatchTo),
    carrierId: first(raw.carrierId),
    status: first(raw.status),
    deliveryNumber: first(raw.deliveryNumber),
    orderNumber: first(raw.orderNumber),
  });
  const [{ items, total }, summary, activeCarriers, filterCarriers] = await Promise.all([
    listShipments(filters),
    getShipmentsSummary(filters),
    listActiveCarriers(),
    listCarriersForShipmentFilters(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const hasAdvancedFilters = Boolean(
    filters.carrierId ||
    filters.status !== "all" ||
    filters.deliveryNumber ||
    filters.orderNumber ||
    filters.datePreset === "custom"
  );
  const clearHref = shipmentHref({
    ...filters,
    query: undefined,
    carrierId: undefined,
    status: "all",
    deliveryNumber: undefined,
    orderNumber: undefined,
    datePreset: "all",
    dispatchFrom: undefined,
    dispatchTo: undefined,
    page: 1,
  });

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5 lg:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-medium">Operations</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Shipments
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Plan and review transport groupings.
          </p>
        </div>
        <CreateShipmentDialog carriers={activeCarriers} />
      </header>
      <nav aria-label="Dispatch date shortcuts" className="flex flex-wrap gap-2">
        {(
          [
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["thisWeek", "This Week"],
            ["all", "All"],
          ] as const
        ).map(([preset, label]) => (
          <Button
            key={preset}
            nativeButton={false}
            render={
              <Link
                href={shipmentHref({
                  ...filters,
                  datePreset: preset,
                  dispatchFrom: undefined,
                  dispatchTo: undefined,
                  page: 1,
                })}
              />
            }
            size="sm"
            variant={filters.datePreset === preset ? "default" : "outline"}
          >
            {label}
          </Button>
        ))}
      </nav>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Total Shipments", summary.shipments],
          ["Planned Pallets", summary.plannedPallets],
          ["Actual Pallets", summary.actualPallets],
          ["Actual Weight", formatOperationalWeight(summary.actualWeight)],
          ["Open Shipments", summary.openShipments],
        ].map(([label, value]) => (
          <div
            className="border-border/70 bg-card rounded-xl border p-4 shadow-sm"
            key={String(label)}
          >
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="mt-1 text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <OperationsPanel aria-label="Shipments workspace">
        <div className="border-border/80 flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <ShipmentsLiveSearch initialQuery={filters.query} />
          <ShipmentsFilters carriers={filterCarriers} />
        </div>
        {items.length ? (
          <div className="flex min-h-0 flex-col lg:h-[calc(100dvh-24rem)]">
            <ShipmentsTable filters={filters} items={items} />
            <footer className="border-border/80 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                {total} {total === 1 ? "shipment" : "shipments"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  aria-label="Go to the previous Shipments page"
                  disabled={filters.page <= 1}
                  nativeButton={false}
                  render={<Link href={shipmentHref(filters, Math.max(1, filters.page - 1))} />}
                  size="sm"
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page {filters.page} of {totalPages}
                </span>
                <Button
                  aria-label="Go to the next Shipments page"
                  disabled={filters.page >= totalPages}
                  nativeButton={false}
                  render={
                    <Link href={shipmentHref(filters, Math.min(totalPages, filters.page + 1))} />
                  }
                  size="sm"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </footer>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <EmptyState
              description={
                filters.query || hasAdvancedFilters
                  ? "No Shipments match the selected filters."
                  : "Shipments will appear here when they are available."
              }
              icon={Search}
              title={
                filters.query || hasAdvancedFilters
                  ? "No matching Shipments"
                  : "No Shipments available"
              }
            />
            <Button
              nativeButton={false}
              render={<Link href={clearHref} />}
              size="sm"
              variant="outline"
            >
              {filters.query || hasAdvancedFilters ? "Clear filters" : "View all Shipments"}
            </Button>
          </div>
        )}
      </OperationsPanel>
    </div>
  );
}
