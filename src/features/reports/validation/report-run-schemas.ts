import { z } from "zod";

import { dailyOrdersReportFiltersSchema } from "@/features/reports/validation/report-schemas";

export const createDailyOrdersReportSchema = z.object({
  filters: dailyOrdersReportFiltersSchema,
});

export const reportRunIdSchema = z.string().uuid();
export const reportArtifactFormatSchema = z.enum(["XLSX", "PDF"]);
