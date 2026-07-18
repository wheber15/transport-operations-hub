import "server-only";

import { getDashboardData as getDashboardDataFromRepository } from "@/features/dashboard/repositories/dashboard-repository";
import { dashboardRequestSchema } from "@/features/dashboard/validation/dashboard-schemas";
import { getOperationalDateOnlyRange } from "@/server/config/operational-timezone";

export async function getDashboard(input: unknown = {}) {
  dashboardRequestSchema.parse(input);

  return getDashboardDataFromRepository(getOperationalDateOnlyRange());
}
