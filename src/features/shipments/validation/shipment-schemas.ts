import "server-only";

import { z } from "zod";

import { shipmentSortFields } from "@/features/shipments/types/shipment";

const optionalSearchQuery = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).max(200).optional()
);

export const shipmentSearchFiltersSchema = z.object({
  query: optionalSearchQuery,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(shipmentSortFields).default("shipmentNumber"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

export const shipmentIdSchema = z.string().uuid();

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
