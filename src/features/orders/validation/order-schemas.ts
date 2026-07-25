import { z } from "zod";

import { orderSortFields } from "@/features/orders/domain/order";

const optionalText = z.string().trim().min(1).nullable().optional();
const optionalSearchQuery = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).max(200).optional()
);

const orderDatePresetValues = [
  "today",
  "tomorrow",
  "yesterday",
  "thisWeek",
  "all",
  "custom",
] as const;
const orderDatePresetSchema = z.preprocess(
  (value) =>
    typeof value === "string" &&
    orderDatePresetValues.includes(value as (typeof orderDatePresetValues)[number])
      ? value
      : undefined,
  z.enum(orderDatePresetValues).default("today")
);

export const orderSearchFiltersSchema = z.object({
  query: optionalSearchQuery,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(orderSortFields).default("orderNumber"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  datePreset: orderDatePresetSchema,
  goodsIssueFrom: z.string().date().optional(),
  goodsIssueTo: z.string().date().optional(),
  customer: optionalSearchQuery,
  route: optionalSearchQuery,
  shipTo: optionalSearchQuery,
  shipmentState: z.enum(["all", "assigned", "unassigned"]).default("all"),
  palletState: z.enum(["all", "awaiting", "captured"]).default("all"),
  status: optionalSearchQuery,
  recordState: z.enum(["active", "deleted", "all"]).default("active"),
});

export const orderIdSchema = z.string().uuid();

export const orderCreateSchema = z.object({
  orderNumber: z.string().trim().min(1).max(100),
  customerId: z.string().uuid(),
  pickingNumber: optionalText,
  goodsIssueDate: z.coerce.date().nullable().optional(),
});

export const orderUpdateSchema = z
  .object({
    orderNumber: z.string().trim().min(1).max(100).optional(),
    customerId: z.string().uuid().optional(),
    pickingNumber: optionalText,
    goodsIssueDate: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one approved order field is required.",
  });

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;

const optionalManualText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().min(1).max(200).nullable().optional()
);

const positiveDecimal = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/, "Enter a valid weight with up to three decimal places.")
  .refine(
    (value) => value !== "0" && !/^0\.0{1,3}$/.test(value),
    "SAP gross weight must be above 0 kg."
  )
  .nullable()
  .optional();

export const orderAdminUpdateSchema = z
  .object({
    pickingNumber: optionalManualText,
    goodsIssueDate: z.string().date().nullable().optional(),
    shipToNumber: optionalManualText,
    routeCode: optionalManualText,
    shippingPoint: optionalManualText,
    grossWeightKg: positiveDecimal,
    purchaseOrderNumber: optionalManualText,
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one approved Order field is required.",
  });

export type OrderAdminUpdateInput = z.infer<typeof orderAdminUpdateSchema>;
