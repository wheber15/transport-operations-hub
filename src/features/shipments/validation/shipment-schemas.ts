import "server-only";

import { z } from "zod";

import { shipmentSortFields } from "@/features/shipments/types/shipment";

const optionalSearchQuery = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).max(200).optional()
);

export const shipmentSearchFiltersSchema = z
  .object({
    query: optionalSearchQuery,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    datePreset: z.enum(["today", "yesterday", "thisWeek", "all", "custom"]).default("all"),
    dispatchFrom: z.string().date().optional(),
    dispatchTo: z.string().date().optional(),
    carrierId: z.string().uuid().optional(),
    status: z.enum(["open", "closed", "all"]).default("all"),
    deliveryNumber: optionalSearchQuery,
    orderNumber: optionalSearchQuery,
    sortBy: z.enum(shipmentSortFields).default("shipmentNumber"),
    sortDirection: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine(
    (filters) =>
      !filters.dispatchFrom || !filters.dispatchTo || filters.dispatchFrom <= filters.dispatchTo,
    {
      message: "Dispatch date end must not be earlier than the start date.",
      path: ["dispatchTo"],
    }
  );

export const shipmentIdSchema = z.string().uuid();
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().min(1).max(500).nullable().optional()
);
const shipmentFields = z.object({
  shipmentNumber: z.string().trim().min(1).max(100),
  carrierId: z.string().uuid(),
  dispatchDate: z.string().date(),
  deliveryDate: z.string().date().nullable().optional(),
  saturdayOvertime: z.boolean().optional(),
  notes: optionalText,
});

export const shipmentCreateSchema = shipmentFields.strict().superRefine((data, context) => {
  if (data.deliveryDate && data.deliveryDate <= data.dispatchDate)
    context.addIssue({
      code: "custom",
      message: "Delivery Date must be after Dispatch Date.",
      path: ["deliveryDate"],
    });
});
export const shipmentUpdateSchema = shipmentFields
  .partial()
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined))
  .superRefine((data, context) => {
    if (data.deliveryDate && data.dispatchDate && data.deliveryDate <= data.dispatchDate)
      context.addIssue({
        code: "custom",
        message: "Delivery Date must be after Dispatch Date.",
        path: ["deliveryDate"],
      });
  });

export const shipmentCloseSchema = z.object({ confirmEmpty: z.literal(true).optional() }).strict();

export const deliveryAssignmentSchema = z
  .object({
    deliveryId: z.string().uuid(),
  })
  .strict();

export const deliveryAssignmentRouteSchema = z.object({
  shipmentId: z.string().uuid(),
  deliveryId: z.string().uuid(),
});

export const deliveryImportPreviewSchema = z
  .object({
    deliveryNumbers: z.string().min(1).max(20_000),
  })
  .strict();

export const deliveryImportCommitSchema = z
  .object({
    deliveryNumbers: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(200)
          .regex(/^[^\s,;]+$/)
      )
      .min(1)
      .max(400),
  })
  .strict();
