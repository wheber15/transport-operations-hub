import "server-only";

import { z } from "zod";

export const carrierExportStageSchema = z.enum(["INITIAL", "UPDATE", "ADDITION"]);
export const carrierExportIdSchema = z.string().uuid();

export const carrierExportPreviewSchema = z.object({
  carrierId: z.string().uuid(),
  goodsIssueDate: z.string().date(),
  stage: carrierExportStageSchema,
  baselineRunId: z.string().uuid().optional(),
});

export const carrierExportGenerateSchema = carrierExportPreviewSchema;

export type CarrierExportPreviewInput = z.infer<typeof carrierExportPreviewSchema>;
export type CarrierExportGenerateInput = z.infer<typeof carrierExportGenerateSchema>;
