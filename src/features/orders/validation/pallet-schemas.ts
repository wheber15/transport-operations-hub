import "server-only";

import { z } from "zod";

import { isValidPalletWeight, palletWeightMaximumKg } from "@/features/orders/domain/pallets";

const palletWeightSchema = z
  .string()
  .trim()
  .refine(isValidPalletWeight, `Enter a weight above 0 and no more than ${palletWeightMaximumKg} kg.`);

export const palletSetSchema = z.object({
  pallets: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        sequenceNumber: z.number().int().positive(),
        actualWeightKg: palletWeightSchema,
        note: z.string().trim().max(500).nullable().optional(),
      }).strict()
    )
    .min(1, "Add at least one actual pallet before saving.")
    .max(500)
    .superRefine((pallets, context) => {
      const seen = new Set<number>();
      for (const [index, pallet] of pallets.entries()) {
        if (seen.has(pallet.sequenceNumber)) {
          context.addIssue({ code: "custom", message: "Pallet sequence numbers must be unique.", path: [index, "sequenceNumber"] });
        }
        seen.add(pallet.sequenceNumber);
      }
    }),
  updatedAt: z.string().datetime().optional(),
}).strict();

export const palletClearSchema = z.object({
  updatedAt: z.string().datetime().optional(),
}).strict();

export type PalletSetInput = z.infer<typeof palletSetSchema>;
