import { z } from "zod";
import { importLimits, importTypes } from "@/features/data-management/domain/constants";
export const importTypeSchema = z.enum(importTypes);
export const mappingSchema = z
  .object({
    headerRow: z.coerce.number().int().min(1).max(importLimits.maxHeaderRow),
    selectedSheetName: z.string().min(1).max(255),
    mapping: z.record(z.string(), z.string().min(1).max(255)),
  })
  .superRefine(({ mapping }, ctx) => {
    const used = new Set<string>();
    Object.entries(mapping).forEach(([target, source]) => {
      if (used.has(source))
        ctx.addIssue({
          code: "custom",
          path: ["mapping", target],
          message: "A source column can only map to one target.",
        });
      used.add(source);
    });
  });
