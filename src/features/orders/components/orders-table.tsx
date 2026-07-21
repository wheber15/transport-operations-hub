import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import { formatBusinessDate } from "@/features/orders/domain/date-formatting";
import { formatSapWeight } from "@/features/data-management/domain/preview";
import { ManagePalletsDialog } from "@/features/orders/components/manage-pallets-dialog";
import { OrderAdminActions } from "@/features/orders/components/order-admin-actions";
import type {
  OrderListItem,
  OrderSearchFilters,
  OrderSortField,
} from "@/features/orders/domain/order";

type OrdersTableProps = {
  items: OrderListItem[];
  filters: OrderSearchFilters;
  canManagePallets: boolean;
  canManageOrders: boolean;
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

function getWeightStatusLabel(status: OrderListItem["palletWeightStatus"]) {
  return status === "under"
    ? "Under SAP weight"
    : status === "exact"
      ? "Exact SAP weight"
      : status === "over"
        ? "Over SAP weight"
        : status === "awaiting"
          ? "Awaiting pallet data"
          : "SAP gross weight unavailable";
}

export function OrdersTable({
  canManageOrders,
  canManagePallets,
  items,
  filters,
}: OrdersTableProps) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="border-border/80 bg-muted/30 sticky top-0 z-10 border-y">
          <tr>
            <SortableHeader field="orderNumber" filters={filters}>
              Sales Order
            </SortableHeader>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Delivery
            </th>
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
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Ship-To
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Route
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              SAP Gross Weight
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Estimated Pallets
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Actual Pallets
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Actual Pallet Weight
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Weight variance
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Status
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Shipment
            </th>
            <th
              className="text-muted-foreground px-4 py-3 text-right text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-border/80 divide-y">
          {items.map((order) => (
            <tr
              className={
                order.deletedAt
                  ? "bg-muted/40 text-muted-foreground hover:bg-muted/60 transition-colors"
                  : "hover:bg-muted/30 transition-colors"
              }
              key={order.id}
            >
              <td className="px-4 py-3.5 text-sm font-medium">
                <Link className="text-primary hover:underline" href={`/orders/${order.id}`}>
                  {order.orderNumber}
                </Link>
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.deliveryNumber ?? "—"}
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
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.shipToNumber ?? "—"}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.routeCode ?? "—"}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {formatSapWeight(order.grossWeightKg) ?? "—"}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.estimatedPalletCount ?? "Not available"}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.actualPalletCount === null ? "Not captured" : order.actualPalletCount}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {formatSapWeight(order.actualPalletWeightKg) ?? "Not counted"}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.weightVarianceKg ? formatSapWeight(order.weightVarianceKg) : "Not available"}
              </td>
              <td className="px-4 py-3.5 text-sm">
                <span
                  className={
                    order.palletStatus === "captured"
                      ? "bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-medium"
                      : "bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs font-medium"
                  }
                >
                  {order.palletStatus === "captured" ? "Captured" : "Awaiting pallet data"}
                </span>
                <p className="text-muted-foreground mt-1 text-xs">
                  {getWeightStatusLabel(order.palletWeightStatus)}
                </p>
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {order.shipmentNumber ?? "Not assigned"}
              </td>
              <td className="px-4 py-3.5 text-right">
                <div className="inline-flex items-center justify-end gap-1">
                  {canManagePallets &&
                  order.deliveryId &&
                  order.deliveryNumber &&
                  !order.deletedAt ? (
                    <ManagePalletsDialog
                      deliveryId={order.deliveryId}
                      deliveryNumber={order.deliveryNumber}
                    />
                  ) : !canManageOrders ? (
                    <Link
                      className="text-primary text-sm hover:underline"
                      href={`/orders/${order.id}`}
                    >
                      View details
                    </Link>
                  ) : null}
                  {canManageOrders ? (
                    <OrderAdminActions
                      order={{
                        id: order.id,
                        orderNumber: order.orderNumber,
                        customerName: order.customerName,
                        deliveryNumber: order.deliveryNumber,
                        pickingNumber: order.pickingNumber,
                        goodsIssueDate: order.goodsIssueDate?.toISOString().slice(0, 10) ?? null,
                        shipToNumber: order.shipToNumber,
                        routeCode: order.routeCode,
                        shippingPoint: order.shippingPoint,
                        grossWeightKg: order.grossWeightKg,
                        deletedAt: order.deletedAt?.toISOString() ?? null,
                      }}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
