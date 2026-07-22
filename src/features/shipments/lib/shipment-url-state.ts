import type { ShipmentSearchFilters } from "@/features/shipments/types/shipment";

export const shipmentAdvancedFilterKeys = [
  "carrierId",
  "status",
  "dispatchFrom",
  "dispatchTo",
  "deliveryNumber",
  "orderNumber",
] as const;

export function shipmentHref(filters: ShipmentSearchFilters, page = filters.page) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(filters.pageSize),
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
    datePreset: filters.datePreset,
  });
  if (filters.query) params.set("q", filters.query);
  for (const [key, value] of Object.entries({
    carrierId: filters.carrierId,
    status: filters.status,
    dispatchFrom: filters.datePreset === "custom" ? filters.dispatchFrom : undefined,
    dispatchTo: filters.datePreset === "custom" ? filters.dispatchTo : undefined,
    deliveryNumber: filters.deliveryNumber,
    orderNumber: filters.orderNumber,
  })) {
    if (value && value !== "all") params.set(key, value);
  }
  return `/shipments?${params.toString()}`;
}

export function updateShipmentSearchParams(
  current: URLSearchParams,
  updates: Record<string, string | undefined>
) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
  }
  return next;
}
