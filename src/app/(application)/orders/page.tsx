import { Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { Button } from "@/components/ui/button";
import { OrdersTable } from "@/features/orders/components/orders-table";
import {
  getOrdersSummary,
  getValidatedOrderFilters,
  listOrders,
} from "@/features/orders/application/order-service";
import { requireAuthenticatedUser } from "@/features/auth/application/session";
import { canManageDeliveryAssignments } from "@/features/auth/domain/roles";
import { OrdersLiveSearch } from "@/features/orders/components/orders-live-search";
import { OrdersFilters } from "@/features/orders/components/orders-filters";
import { PrintLeftForTodayButton } from "@/features/orders/components/print-left-for-today-button";
import { orderDatePresetOptions } from "@/features/orders/lib/order-date-presets";
import { orderHref, orderPresetHref } from "@/features/orders/lib/order-url-state";

export const metadata: Metadata = {
  title: "Orders",
};

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const user = await requireAuthenticatedUser();
  const rawSearchParams = await searchParams;
  const filters = getValidatedOrderFilters({
    query: getFirstValue(rawSearchParams.query),
    page: getFirstValue(rawSearchParams.page),
    pageSize: getFirstValue(rawSearchParams.pageSize),
    sortBy: getFirstValue(rawSearchParams.sortBy),
    sortDirection: getFirstValue(rawSearchParams.sortDirection),
    datePreset: getFirstValue(rawSearchParams.datePreset),
    goodsIssueFrom: getFirstValue(rawSearchParams.goodsIssueFrom),
    goodsIssueTo: getFirstValue(rawSearchParams.goodsIssueTo),
    customer: getFirstValue(rawSearchParams.customer),
    route: getFirstValue(rawSearchParams.route),
    shipTo: getFirstValue(rawSearchParams.shipTo),
    shipmentState: getFirstValue(rawSearchParams.shipmentState),
    palletState: getFirstValue(rawSearchParams.palletState),
    status: getFirstValue(rawSearchParams.status),
    recordState: getFirstValue(rawSearchParams.recordState),
  });
  const [{ items, total }, summary] = await Promise.all([
    listOrders(filters, user),
    getOrdersSummary(filters, user),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5 lg:gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-primary text-sm font-medium">Operations</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Orders
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Search and review operational orders.
          </p>
        </div>
        <PrintLeftForTodayButton />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Goods Issue Date shortcuts" className="flex flex-wrap gap-2">
          {orderDatePresetOptions.map(([preset, label]) => (
            <Button
              key={preset}
              nativeButton={false}
              render={<Link href={orderPresetHref(preset, filters)} />}
              size="sm"
              variant={filters.datePreset === preset ? "default" : "outline"}
            >
              {label}
            </Button>
          ))}
        </nav>
        {user.role === "Administrator" ? (
          <Button
            nativeButton={false}
            render={<Link href="/orders?datePreset=all&recordState=deleted" />}
            size="sm"
            variant={filters.recordState === "deleted" ? "default" : "outline"}
          >
            Deleted Orders
          </Button>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="border-border/70 bg-card rounded-xl border p-4 shadow-sm">
          <dt className="text-muted-foreground text-sm">Orders</dt>
          <dd className="mt-1 text-xl font-semibold">{summary.orders}</dd>
        </div>
        <div className="border-border/70 bg-card rounded-xl border p-4 shadow-sm">
          <dt className="text-muted-foreground text-sm">Deliveries</dt>
          <dd className="mt-1 text-xl font-semibold">{summary.deliveries}</dd>
        </div>
        <div className="border-border/70 bg-card rounded-xl border p-4 shadow-sm">
          <dt className="text-muted-foreground text-sm">Assigned to Shipment</dt>
          <dd className="mt-1 text-xl font-semibold">{summary.assignedToShipment}</dd>
        </div>
        <div className="border-border/70 bg-card rounded-xl border p-4 shadow-sm">
          <dt className="text-muted-foreground text-sm">Awaiting pallet data</dt>
          <dd className="mt-1 text-xl font-semibold">{summary.awaitingActualPalletData}</dd>
        </div>
      </dl>

      <OperationsPanel aria-label="Orders workspace">
        <form className="border-border/80 flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <OrdersLiveSearch initialQuery={filters.query} />
          <input name="pageSize" type="hidden" value={filters.pageSize} />
          <input name="sortBy" type="hidden" value={filters.sortBy} />
          <input name="sortDirection" type="hidden" value={filters.sortDirection} />
          <input name="datePreset" type="hidden" value={filters.datePreset} />
          <OrdersFilters canViewDeletedOrders={user.role === "Administrator"} />
        </form>

        {items.length > 0 ? (
          <div className="flex min-h-0 flex-col lg:h-[calc(100dvh-23rem)]">
            <OrdersTable
              canManageOrders={user.role === "Administrator"}
              canManagePallets={canManageDeliveryAssignments(user.role)}
              filters={filters}
              items={items}
            />
            <footer className="border-border/80 flex items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                {total} {total === 1 ? "order" : "orders"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  disabled={filters.page <= 1}
                  nativeButton={false}
                  render={<Link href={orderHref(filters, Math.max(1, filters.page - 1))} />}
                  size="sm"
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page {filters.page} of {totalPages}
                </span>
                <Button
                  disabled={filters.page >= totalPages}
                  nativeButton={false}
                  render={
                    <Link href={orderHref(filters, Math.min(totalPages, filters.page + 1))} />
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
          <EmptyState
            description={
              filters.query
                ? "Try a different order number, picking number, or customer name."
                : filters.datePreset === "today"
                  ? "No Orders have a Goods Issue Date of today."
                  : "Orders will appear here when they are available."
            }
            icon={Search}
            title={
              filters.query
                ? "No matching orders"
                : filters.datePreset === "today"
                  ? "No Orders today"
                  : "No orders available"
            }
          />
        )}
      </OperationsPanel>
    </div>
  );
}
