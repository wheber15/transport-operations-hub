import { z } from "zod";

const presets = ["today", "tomorrow", "yesterday", "thisWeek", "custom"] as const;
const presetSchema = z.preprocess(
  (value) =>
    typeof value === "string" && presets.includes(value as (typeof presets)[number])
      ? value
      : undefined,
  z.enum(presets).default("today")
);
const optionalQuery = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(200).optional()
);

export const dailyOrdersReportFiltersSchema = z
  .object({
    datePreset: presetSchema,
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    query: optionalQuery,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    customer: optionalQuery,
    route: optionalQuery,
    shipTo: optionalQuery,
    carrier: optionalQuery,
    shipmentState: z.enum(["all", "assigned", "unassigned"]).default("all"),
    palletState: z.enum(["all", "awaiting", "captured"]).default("all"),
    recordState: z.enum(["active", "deleted", "all"]).default("active"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "End date must not be earlier than the start date.",
  });

export type DailyOrdersReportFilters = z.infer<typeof dailyOrdersReportFiltersSchema>;
