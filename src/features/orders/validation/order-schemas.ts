import { z } from "zod";

import { orderSortFields } from "@/features/orders/domain/order";

const optionalText = z.string().trim().min(1).nullable().optional();
const optionalSearchQuery = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).max(200).optional()
);

export const orderSearchFiltersSchema = z.object({
  query: optionalSearchQuery,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(orderSortFields).default("orderNumber"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
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
