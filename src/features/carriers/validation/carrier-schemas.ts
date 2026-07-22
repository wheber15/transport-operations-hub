import "server-only";

import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(1000).nullable().optional()
);
const phonePattern = /^[0-9+()\-\s.a-z]+$/i;

export const carrierInputSchema = z
  .object({
    carrierNumber: z.string().trim().min(1, "Carrier number is required.").max(100),
    name: z.string().trim().min(1, "Carrier name is required.").max(200),
    contactName: optionalText,
    email: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().email("Enter a valid email address.").max(320).nullable().optional()
    ),
    phone: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z
        .string()
        .trim()
        .regex(phonePattern, "Enter a valid phone number.")
        .max(50)
        .nullable()
        .optional()
    ),
    collectionStartTime: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid collection start time.")
        .nullable()
        .optional()
    ),
    collectionEndTime: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid collection end time.")
        .nullable()
        .optional()
    ),
    dailyTrailerLimit: z.preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.coerce.number().int().positive("Enter a positive whole number.").nullable().optional()
    ),
    notes: optionalText,
    active: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, context) => {
    const start = value.collectionStartTime;
    const end = value.collectionEndTime;
    if (Boolean(start) !== Boolean(end))
      context.addIssue({
        code: "custom",
        message: "Collection start and end are both required.",
        path: [start ? "collectionEndTime" : "collectionStartTime"],
      });
    if (start && end && end <= start)
      context.addIssue({
        code: "custom",
        message: "Collection end must be later than start.",
        path: ["collectionEndTime"],
      });
  });

export const carrierFiltersSchema = z.object({
  query: z.string().trim().max(200).optional(),
  state: z.enum(["active", "inactive", "all"]).default("active"),
});
