import type { OrderActivityRecorder, OrderSearchFilters } from "@/features/orders/domain/order";
import {
  getOrderById as getOrderByIdFromRepository,
  getOrderByOrderNumber as getOrderByOrderNumberFromRepository,
  listOrders as listOrdersFromRepository,
  getOrdersSummary as getOrdersSummaryFromRepository,
  searchOrders as searchOrdersFromRepository,
  restoreOrder as restoreOrderFromRepository,
  softDeleteOrder as softDeleteOrderFromRepository,
  updateActiveOrder as updateActiveOrderFromRepository,
} from "@/features/orders/infrastructure/order-repository";
import {
  orderIdSchema,
  orderSearchFiltersSchema,
  orderAdminUpdateSchema,
} from "@/features/orders/validation/order-schemas";
import { resolveGoodsIssueDateScope } from "@/features/orders/domain/goods-issue-date";
import { areOrderExportFieldsAvailable } from "@/features/orders/lib/order-export-field-gate";

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
  }
}
export class OrderRecordStateForbiddenError extends Error {}
export class OrderAdministrationForbiddenError extends Error {}
export class OrderExportFieldsUnavailableError extends Error {}

function requireAdministrator(actor: { id: string; role: string | null }) {
  if (actor.role !== "Administrator") throw new OrderAdministrationForbiddenError();
}

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
  const result = await listOrdersFromRepository({
    ...filters,
    goodsIssueFrom: scope.from,
    goodsIssueTo: scope.to,
  });

  return { ...result, filters };
}

export async function getOrdersSummary(input: unknown, actor?: { role: string | null }) {
  const filters = orderSearchFiltersSchema.parse(input);
  if (filters.recordState !== "active" && actor?.role !== "Administrator")
    throw new OrderRecordStateForbiddenError();
  const scope = resolveGoodsIssueDateScope(filters.datePreset, new Date(), {
    from: filters.goodsIssueFrom,
    to: filters.goodsIssueTo,
  });
  return getOrdersSummaryFromRepository({
    ...filters,
    goodsIssueFrom: scope.from,
    goodsIssueTo: scope.to,
  });
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

export async function updateOrder(
  actor: { id: string; role: string | null },
  id: unknown,
  input: unknown
) {
  requireAdministrator(actor);
  const orderId = orderIdSchema.parse(id);
  const parsed = orderAdminUpdateSchema.parse(input);
  if (parsed.purchaseOrderNumber !== undefined && !areOrderExportFieldsAvailable()) {
    throw new OrderExportFieldsUnavailableError();
  }
  const updated = await updateActiveOrderFromRepository(actor.id, orderId, parsed);
  if (!updated) throw new OrderNotFoundError();
  return updated;
}

export async function deleteOrder(actor: { id: string; role: string | null }, id: unknown) {
  requireAdministrator(actor);
  const changed = await softDeleteOrderFromRepository(actor.id, orderIdSchema.parse(id));
  if (!changed) throw new OrderNotFoundError();
}

export async function restoreOrder(actor: { id: string; role: string | null }, id: unknown) {
  requireAdministrator(actor);
  const changed = await restoreOrderFromRepository(actor.id, orderIdSchema.parse(id));
  if (!changed) throw new OrderNotFoundError();
}
import "server-only";
