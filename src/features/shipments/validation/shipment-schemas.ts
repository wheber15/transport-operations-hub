import "server-only";

import { z } from "zod";

import { shipmentSortFields } from "@/features/shipments/types/shipment";
import {
  irelandLocalDateTimeToUtc,
  validateMovementTimes,
} from "@/features/shipments/domain/movement";

const optionalSearchQuery = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).max(200).optional()
);

const shipmentDatePresetValues = [
  "today",
  "tomorrow",
  "yesterday",
  "thisWeek",
  "all",
  "custom",
] as const;
const shipmentDatePresetSchema = z.preprocess(
  (value) =>
    typeof value === "string" &&
    shipmentDatePresetValues.includes(value as (typeof shipmentDatePresetValues)[number])
      ? value
      : undefined,
  z.enum(shipmentDatePresetValues).default("all")
);

export const shipmentSearchFiltersSchema = z
  .object({
    query: optionalSearchQuery,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    datePreset: shipmentDatePresetSchema,
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

const movementDateTime = z
  .string()
  .trim()
  .refine((value) => irelandLocalDateTimeToUtc(value) !== null, {
    message: "Enter a valid Ireland local date and time.",
  })
  .nullable();

export const shipmentMovementSchema = z
  .object({
    driverInAt: movementDateTime,
    trailerLoadedAt: movementDateTime,
    driverOutAt: movementDateTime,
  })
  .strict()
  .superRefine((value, context) => {
    const errors = validateMovementTimes({
      driverInAt: value.driverInAt ? irelandLocalDateTimeToUtc(value.driverInAt) : null,
      trailerLoadedAt: value.trailerLoadedAt
        ? irelandLocalDateTimeToUtc(value.trailerLoadedAt)
        : null,
      driverOutAt: value.driverOutAt ? irelandLocalDateTimeToUtc(value.driverOutAt) : null,
    });
    for (const [field, message] of Object.entries(errors)) {
      context.addIssue({ code: "custom", message, path: [field] });
    }
  });

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
