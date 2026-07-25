import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type { DeliveryDetail } from "@/features/deliveries/domain/delivery";

const deliveryDetailSelect = {
  id: true,
  deliveryNumber: true,
  orderId: true,
  shipment: { select: { shipmentNumber: true, deletedAt: true } },
  orderLinks: {
    orderBy: { order: { orderNumber: "asc" } },
    select: {
      orderId: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          purchaseOrderNumber: true,
          grossWeightKg: true,
          goodsIssueDate: true,
          sapGoodsIssueDate: true,
          shipToNumber: true,
          deletedAt: true,
        },
      },
    },
  },
} satisfies Prisma.DeliverySelect;

export async function getDeliveryById(id: string): Promise<DeliveryDetail | null> {
  const delivery = await prisma.delivery.findFirst({
    where: { id, deletedAt: null },
    select: deliveryDetailSelect,
  });
  if (!delivery) return null;

  return {
    id: delivery.id,
    deliveryNumber: delivery.deliveryNumber,
    shipmentNumber: delivery.shipment?.deletedAt === null ? delivery.shipment.shipmentNumber : null,
    linkedOrders: delivery.orderLinks.map((link) => ({
      id: link.order.id,
      orderNumber: link.order.orderNumber,
      isPrimary: link.orderId === delivery.orderId,
      purchaseOrderNumber: link.order.purchaseOrderNumber,
      grossWeightKg: link.order.grossWeightKg?.toFixed(3) ?? null,
      goodsIssueDate: link.order.goodsIssueDate,
      sapGoodsIssueDate: link.order.sapGoodsIssueDate,
      shipToNumber: link.order.shipToNumber,
      deletedAt: link.order.deletedAt,
    })),
  };
}
