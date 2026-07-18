import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { formatBusinessDate } from "@/features/orders/domain/date-formatting";
import type {
  OrderListItem,
  OrderSearchFilters,
  OrderSortField,
} from "@/features/orders/domain/order";

type OrdersTableProps = {
  items: OrderListItem[];
  filters: OrderSearchFilters;
};

function getSortHref(filters: OrderSearchFilters, field: OrderSortField) {
  const sortDirection =
    filters.sortBy === field && filters.sortDirection === "asc" ? "desc" : "asc";
  const searchParams = new URLSearchParams({
    page: "1",
    pageSize: String(filters.pageSize),
    sortBy: field,
    sortDirection,
  });

  if (filters.query) {
    searchParams.set("query", filters.query);
  }

  return `/orders?${searchParams.toString()}`;
}

function SortIcon({ filters, field }: { filters: OrderSearchFilters; field: OrderSortField }) {
  if (filters.sortBy !== field) {
    return <ArrowUpDown aria-hidden="true" className="size-3.5" />;
  }

  return filters.sortDirection === "asc" ? (
    <ArrowUp aria-hidden="true" className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden="true" className="size-3.5" />
  );
}

function SortableHeader({
  children,
  field,
  filters,
}: {
  children: React.ReactNode;
  field: OrderSortField;
  filters: OrderSearchFilters;
}) {
  return (
    <th
      aria-sort={
        filters.sortBy === field
          ? filters.sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
      scope="col"
    >
      <Link
        className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        href={getSortHref(filters, field)}
      >
        {children}
        <SortIcon field={field} filters={filters} />
      </Link>
    </th>
  );
}

export function OrdersTable({ items, filters }: OrdersTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="border-border/80 bg-muted/30 border-y">
          <tr>
            <SortableHeader field="orderNumber" filters={filters}>
              Order Number
            </SortableHeader>
            <SortableHeader field="customer" filters={filters}>
              Customer
            </SortableHeader>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Sales Representative
            </th>
            <SortableHeader field="pickingNumber" filters={filters}>
              Picking Number
            </SortableHeader>
            <SortableHeader field="goodsIssueDate" filters={filters}>
              Goods Issue Date
            </SortableHeader>
          </tr>
        </thead>
        <tbody className="divide-border/80 divide-y">
          {items.map((order) => (
            <tr className="hover:bg-muted/30 transition-colors" key={order.id}>
              <td className="px-4 py-3.5 text-sm font-medium">
                <Link className="text-primary hover:underline" href={`/orders/${order.id}`}>
                  {order.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3.5 text-sm">{order.customerName ?? "Not available"}</td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.salesRepName ?? "Not available"}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.pickingNumber ?? "—"}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {formatBusinessDate(order.goodsIssueDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
