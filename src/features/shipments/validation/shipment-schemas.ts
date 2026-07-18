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
