import "server-only";

import { irelandBusinessDate } from "@/lib/business-date";
import { estimatePalletCount } from "@/features/orders/domain/pallets";
import type { OrdersLeftWorkbookRow } from "@/features/orders/domain/orders-left";
import { listOrdersLeftForBusinessDate } from "@/features/orders/infrastructure/orders-left-repository";

export async function getOrdersLeftForToday(
  referenceDate = new Date()
): Promise<OrdersLeftWorkbookRow[]> {
  const rows = await listOrdersLeftForBusinessDate(irelandBusinessDate(referenceDate));
  return rows.map((row) => ({ ...row, calculatedPallets: estimatePalletCount(row.weightKg) }));
}

export function ordersLeftFilename(referenceDate = new Date()) {
  const [year, month, day] = irelandBusinessDate(referenceDate).split("-");
  return `Orders left for ${day}.${month}.${year.slice(-2)}.xlsx`;
}
