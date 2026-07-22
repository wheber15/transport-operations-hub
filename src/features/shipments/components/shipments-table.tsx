import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import {
  formatDateOnly,
  formatOperationalNumber,
  formatOperationalWeight,
} from "@/features/shipments/lib/date-formatting";
import { shipmentHref } from "@/features/shipments/lib/shipment-url-state";
import type {
  ShipmentListItem,
  ShipmentSearchFilters,
  ShipmentSortField,
} from "@/features/shipments/types/shipment";

type Props = { items: ShipmentListItem[]; filters: ShipmentSearchFilters };
function SortIcon({
  filters,
  field,
}: {
  filters: ShipmentSearchFilters;
  field: ShipmentSortField;
}) {
  return filters.sortBy !== field ? (
    <ArrowUpDown aria-hidden="true" className="size-3.5" />
  ) : filters.sortDirection === "asc" ? (
    <ArrowUp aria-hidden="true" className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden="true" className="size-3.5" />
  );
}
function Header({
  children,
  field,
  filters,
}: {
  children: React.ReactNode;
  field: ShipmentSortField;
  filters: ShipmentSearchFilters;
}) {
  const direction = filters.sortBy === field && filters.sortDirection === "asc" ? "desc" : "asc";
  return (
    <th
      aria-sort={
        filters.sortBy === field
          ? filters.sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className="text-muted-foreground px-3 py-3 text-left text-xs font-medium tracking-wide uppercase"
      scope="col"
    >
      <Link
        className="hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm focus-visible:ring-[3px] focus-visible:outline-none"
        href={shipmentHref({ ...filters, sortBy: field, sortDirection: direction, page: 1 })}
      >
        {children}
        <SortIcon field={field} filters={filters} />
      </Link>
    </th>
  );
}
export function ShipmentsTable({ items, filters }: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[940px] border-collapse">
        <caption className="sr-only">Shipments matching the current workspace filters</caption>
        <thead className="border-border/80 bg-muted/30 sticky top-0 z-10 border-y">
          <tr>
            <Header field="shipmentNumber" filters={filters}>
              Shipment
            </Header>
            <Header field="carrier" filters={filters}>
              Carrier
            </Header>
            <Header field="dispatchDate" filters={filters}>
              Dispatch
            </Header>
            <Header field="deliveryCount" filters={filters}>
              Deliveries
            </Header>
            <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium tracking-wide uppercase">
              Orders
            </th>
            <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium tracking-wide uppercase">
              Planned
            </th>
            <Header field="actualPallets" filters={filters}>
              Actual pallets
            </Header>
            <Header field="actualWeight" filters={filters}>
              Actual weight
            </Header>
            <th className="text-muted-foreground px-3 py-3 text-left text-xs font-medium tracking-wide uppercase">
              Status
            </th>
            <th className="text-muted-foreground px-3 py-3 text-right text-xs font-medium tracking-wide uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-border/80 divide-y">
          {items.map((shipment) => (
            <tr className="hover:bg-muted/30 transition-colors" key={shipment.id}>
              <td className="px-3 py-3.5 text-sm font-medium">
                <Link
                  className="text-primary focus-visible:ring-ring/50 rounded-sm hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
                  href={`/shipments/${shipment.id}`}
                >
                  {shipment.shipmentNumber}
                </Link>
              </td>
              <td className="px-3 py-3.5 text-sm">
                <p>{shipment.carrierName ?? "Not available"}</p>
                {shipment.carrierNumber ? (
                  <p className="text-muted-foreground text-xs">{shipment.carrierNumber}</p>
                ) : null}
              </td>
              <td className="text-muted-foreground px-3 py-3.5 text-sm">
                {formatDateOnly(shipment.dispatchDate)}
              </td>
              <td className="text-muted-foreground px-3 py-3.5 text-sm">
                {shipment.deliveryCount}
              </td>
              <td className="text-muted-foreground px-3 py-3.5 text-sm">{shipment.orderCount}</td>
              <td className="text-muted-foreground px-3 py-3.5 text-sm">
                {formatOperationalNumber(shipment.estimatedPallets)}
              </td>
              <td className="text-muted-foreground px-3 py-3.5 text-sm">
                {formatOperationalNumber(shipment.actualPallets)}
              </td>
              <td className="text-muted-foreground px-3 py-3.5 text-sm">
                {formatOperationalWeight(shipment.actualWeight)}
              </td>
              <td className="px-3 py-3.5 text-sm">
                <span
                  className={
                    shipment.status === "OPEN"
                      ? "bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-medium"
                      : "bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs font-medium"
                  }
                >
                  {shipment.status === "OPEN" ? "Open" : "Closed"}
                </span>
              </td>
              <td className="px-3 py-3.5 text-right">
                <Link
                  aria-label={`View Shipment ${shipment.shipmentNumber}`}
                  className="text-primary text-sm hover:underline"
                  href={`/shipments/${shipment.id}`}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
