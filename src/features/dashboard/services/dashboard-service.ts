import "server-only";

import { getDashboardData as getDashboardDataFromRepository } from "@/features/dashboard/repositories/dashboard-repository";
import { dashboardRequestSchema } from "@/features/dashboard/validation/dashboard-schemas";
import { resolveGoodsIssueDateScope } from "@/features/orders/domain/goods-issue-date";

export async function getDashboard(input: unknown = {}) {
  dashboardRequestSchema.parse(input);

  const scope = resolveGoodsIssueDateScope("today");
  const start = new Date(`${scope.from}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return getDashboardDataFromRepository({ start, end });
}
