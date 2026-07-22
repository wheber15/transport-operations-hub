import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type { OrdersLeftRow } from "@/features/orders/domain/orders-left";

const leftForTodaySelect = {
  deliveryNumber: true,
  order: {
    select: {
      grossWeightKg: true,
      customer: { select: { name: true, deletedAt: true } },
    },
  },
} satisfies Prisma.DeliverySelect;

export async function listOrdersLeftForBusinessDate(
  businessDate: string
): Promise<OrdersLeftRow[]> {
  const start = new Date(`${businessDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const rows = await prisma.delivery.findMany({
    where: {
      deletedAt: null,
      shipmentId: null,
      order: {
        is: {
          deletedAt: null,
          goodsIssueDate: { gte: start, lt: end },
          customer: { is: { deletedAt: null } },
        },
      },
    },
    select: leftForTodaySelect,
  });

  return rows
    .map((row) => ({
      deliveryNumber: row.deliveryNumber,
      customerName: row.order.customer.name,
      weightKg: row.order.grossWeightKg?.toFixed(3) ?? null,
    }))
    .sort(
      (left, right) =>
        left.customerName.localeCompare(right.customerName, "en-IE") ||
        left.deliveryNumber.localeCompare(right.deliveryNumber, "en-IE")
    );
}
