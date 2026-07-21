import type { OrderActivityRecorder, OrderSearchFilters } from "@/features/orders/domain/order";
import {
  getOrderById as getOrderByIdFromRepository,
  getOrderByOrderNumber as getOrderByOrderNumberFromRepository,
  listOrders as listOrdersFromRepository,
  getOrdersSummary as getOrdersSummaryFromRepository,
  searchOrders as searchOrdersFromRepository,
} from "@/features/orders/infrastructure/order-repository";
import {
  orderIdSchema,
  orderSearchFiltersSchema,
} from "@/features/orders/validation/order-schemas";
import { resolveGoodsIssueDateScope } from "@/features/orders/domain/goods-issue-date";

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
  }
}
export class OrderRecordStateForbiddenError extends Error {}

export type OrderServiceDependencies = {
  activityRecorder?: OrderActivityRecorder;
};

export async function listOrders(input: unknown, actor?: { role: string | null }) {
  const filters = orderSearchFiltersSchema.parse(input);
  if (filters.recordState !== "active" && actor?.role !== "Administrator") {
    throw new OrderRecordStateForbiddenError();
  }
  const scope = resolveGoodsIssueDateScope(filters.datePreset, new Date(), {
    from: filters.goodsIssueFrom,
    to: filters.goodsIssueTo,
  });
  const result = await listOrdersFromRepository({ ...filters, goodsIssueFrom: scope.from, goodsIssueTo: scope.to });

  return { ...result, filters };
}

export async function getOrdersSummary(input: unknown, actor?: { role: string | null }) {
  const filters = orderSearchFiltersSchema.parse(input);
  if (filters.recordState !== "active" && actor?.role !== "Administrator") throw new OrderRecordStateForbiddenError();
  const scope = resolveGoodsIssueDateScope(filters.datePreset, new Date(), { from: filters.goodsIssueFrom, to: filters.goodsIssueTo });
  return getOrdersSummaryFromRepository({ ...filters, goodsIssueFrom: scope.from, goodsIssueTo: scope.to });
}

export async function searchOrders(query: unknown) {
  const filters = orderSearchFiltersSchema.parse({ query });

  return searchOrdersFromRepository(filters.query ?? "", filters.page, filters.pageSize);
}

export async function getOrderById(input: unknown) {
  const id = orderIdSchema.parse(input);
  const order = await getOrderByIdFromRepository(id);

  if (!order) {
    throw new OrderNotFoundError();
  }

  return order;
}

export async function getOrderByOrderNumber(orderNumber: string) {
  return getOrderByOrderNumberFromRepository(orderNumber);
}

export function getOrderActivityRecorder(dependencies: OrderServiceDependencies) {
  return dependencies.activityRecorder;
}

export function getValidatedOrderFilters(input: unknown): OrderSearchFilters {
  const filters = orderSearchFiltersSchema.parse(input);
  const scope = resolveGoodsIssueDateScope(filters.datePreset, new Date(), {
    from: filters.goodsIssueFrom,
    to: filters.goodsIssueTo,
  });
  return { ...filters, goodsIssueFrom: scope.from, goodsIssueTo: scope.to };
}
import "server-only";
