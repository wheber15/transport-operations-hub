import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

import {
  formatBusinessDate,
  formatOperationalNumber,
  formatOperationalWeight,
} from "@/features/shipments/lib/date-formatting";
import type {
  ShipmentListItem,
  ShipmentSearchFilters,
  ShipmentSortField,
} from "@/features/shipments/types/shipment";

type ShipmentsTableProps = {
  items: ShipmentListItem[];
  filters: ShipmentSearchFilters;
};

function getSortHref(filters: ShipmentSearchFilters, field: ShipmentSortField) {
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

  return `/shipments?${searchParams.toString()}`;
}

function SortIcon({
  filters,
  field,
}: {
  filters: ShipmentSearchFilters;
  field: ShipmentSortField;
}) {
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
  field: ShipmentSortField;
  filters: ShipmentSearchFilters;
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
        className="hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
        href={getSortHref(filters, field)}
      >
        {children}
        <SortIcon field={field} filters={filters} />
      </Link>
    </th>
  );
}

export function ShipmentsTable({ items, filters }: ShipmentsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-collapse">
        <thead className="border-border/80 bg-muted/30 border-y">
          <tr>
            <SortableHeader field="shipmentNumber" filters={filters}>
              Shipment Number
            </SortableHeader>
            <SortableHeader field="carrier" filters={filters}>
              Carrier
            </SortableHeader>
            <SortableHeader field="dispatchDate" filters={filters}>
              Dispatch Date
            </SortableHeader>
            <SortableHeader field="deliveryDate" filters={filters}>
              Delivery Date
            </SortableHeader>
            <SortableHeader field="actualPallets" filters={filters}>
              Actual Pallets
            </SortableHeader>
            <SortableHeader field="actualWeight" filters={filters}>
              Actual Weight
            </SortableHeader>
            <SortableHeader field="deliveryCount" filters={filters}>
              Deliveries
            </SortableHeader>
            <th
              className="text-muted-foreground px-4 py-3 text-left text-xs font-medium tracking-wide uppercase"
              scope="col"
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-border/80 divide-y">
          {items.map((shipment) => (
            <tr className="hover:bg-muted/30 transition-colors" key={shipment.id}>
              <td className="px-4 py-3.5 text-sm font-medium">
                <Link
                  className="text-primary focus-visible:ring-ring/50 rounded-sm hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
                  href={`/shipments/${shipment.id}`}
                >
                  {shipment.shipmentNumber}
                </Link>
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {shipment.carrierName ?? "Not available"}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {formatBusinessDate(shipment.dispatchDate)}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {formatBusinessDate(shipment.deliveryDate)}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {formatOperationalNumber(shipment.actualPallets)}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {formatOperationalWeight(shipment.actualWeight)}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">
                {shipment.deliveryCount}
              </td>
              <td className="text-muted-foreground px-4 py-3.5 text-sm">Not available</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
