import type { DashboardOrder } from "@/features/dashboard/types/dashboard";

export function getDashboardDeliveryHref(
  order: Pick<DashboardOrder, "deliveryId" | "salesOrderId">
) {
  return order.deliveryId ? `/orders/${order.salesOrderId}#delivery-${order.deliveryId}` : null;
}

export function getDashboardDeliveryLabel(deliveryNumber: string | null) {
  return deliveryNumber ? `Delivery ${deliveryNumber}` : "Delivery unavailable";
}
