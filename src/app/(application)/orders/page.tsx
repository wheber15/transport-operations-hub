import { Filter, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { Button } from "@/components/ui/button";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { getValidatedOrderFilters, listOrders } from "@/features/orders/application/order-service";

export const metadata: Metadata = {
  title: "Orders",
};

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPageHref(page: number, filters: ReturnType<typeof getValidatedOrderFilters>) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(filters.pageSize),
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
  });

  if (filters.query) {
    searchParams.set("query", filters.query);
  }

  return `/orders?${searchParams.toString()}`;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const rawSearchParams = await searchParams;
  const filters = getValidatedOrderFilters({
    query: getFirstValue(rawSearchParams.query),
    page: getFirstValue(rawSearchParams.page),
    pageSize: getFirstValue(rawSearchParams.pageSize),
    sortBy: getFirstValue(rawSearchParams.sortBy),
    sortDirection: getFirstValue(rawSearchParams.sortDirection),
  });
  const { items, total } = await listOrders(filters);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
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
      </header>

      <OperationsPanel aria-label="Orders workspace">
        <form className="border-border/80 flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor="order-search">
              Search orders, picking numbers, or customers
            </label>
            <Search
              aria-hidden="true"
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border pr-3 pl-9 text-sm outline-none focus-visible:ring-[3px]"
              defaultValue={filters.query}
              id="order-search"
              name="query"
              placeholder="Search orders, picking numbers, or customers"
              type="search"
            />
          </div>
          <input name="pageSize" type="hidden" value={filters.pageSize} />
          <input name="sortBy" type="hidden" value={filters.sortBy} />
          <input name="sortDirection" type="hidden" value={filters.sortDirection} />
          <Button size="sm" type="submit" variant="outline">
            <Search aria-hidden="true" />
            Search
          </Button>
          <Button disabled size="sm" type="button" variant="outline">
            <Filter aria-hidden="true" />
            Filters
          </Button>
        </form>

        {items.length > 0 ? (
          <>
            <OrdersTable filters={filters} items={items} />
            <footer className="border-border/80 flex items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                {total} {total === 1 ? "order" : "orders"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  disabled={filters.page <= 1}
                  nativeButton={false}
                  render={<Link href={getPageHref(Math.max(1, filters.page - 1), filters)} />}
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
                    <Link href={getPageHref(Math.min(totalPages, filters.page + 1), filters)} />
                  }
                  size="sm"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <EmptyState
            description={
              filters.query
                ? "Try a different order number, picking number, or customer name."
                : "Orders will appear here when they are available."
            }
            icon={Search}
            title={filters.query ? "No matching orders" : "No orders available"}
          />
        )}
      </OperationsPanel>
    </div>
  );
}
