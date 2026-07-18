import type { OrderActivityRecorder, OrderSearchFilters } from "@/features/orders/domain/order";
import {
  getOrderById as getOrderByIdFromRepository,
  getOrderByOrderNumber as getOrderByOrderNumberFromRepository,
  listOrders as listOrdersFromRepository,
  searchOrders as searchOrdersFromRepository,
} from "@/features/orders/infrastructure/order-repository";
import {
  orderIdSchema,
  orderSearchFiltersSchema,
} from "@/features/orders/validation/order-schemas";

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
  }
}

export type OrderServiceDependencies = {
  activityRecorder?: OrderActivityRecorder;
};

export async function listOrders(input: unknown) {
  const filters = orderSearchFiltersSchema.parse(input);
  const result = await listOrdersFromRepository(filters);

  return { ...result, filters };
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
  return orderSearchFiltersSchema.parse(input);
}
import "server-only";
