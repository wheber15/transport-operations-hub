import type { OrderSearchFilters } from "@/features/orders/domain/order";
import { orderDatePresetOptions } from "@/features/orders/lib/order-date-presets";

function setCompatibleFilters(params: URLSearchParams, filters: OrderSearchFilters) {
  if (filters.query) params.set("query", filters.query);
  for (const [key, value] of Object.entries({
    customer: filters.customer,
    route: filters.route,
    shipTo: filters.shipTo,
    shipmentState: filters.shipmentState,
    palletState: filters.palletState,
    status: filters.status,
    recordState: filters.recordState,
  })) {
    if (value && !["all", "active"].includes(value)) params.set(key, value);
  }
}

export function orderHref(filters: OrderSearchFilters, page = filters.page) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(filters.pageSize),
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
    datePreset: filters.datePreset,
  });
  if (filters.datePreset === "custom") {
    if (filters.goodsIssueFrom) params.set("goodsIssueFrom", filters.goodsIssueFrom);
    if (filters.goodsIssueTo) params.set("goodsIssueTo", filters.goodsIssueTo);
  }
  setCompatibleFilters(params, filters);
  return `/orders?${params.toString()}`;
}

export function orderPresetHref(
  preset: (typeof orderDatePresetOptions)[number][0],
  filters: OrderSearchFilters
) {
  return orderHref(
    { ...filters, datePreset: preset, goodsIssueFrom: undefined, goodsIssueTo: undefined },
    1
  );
}
