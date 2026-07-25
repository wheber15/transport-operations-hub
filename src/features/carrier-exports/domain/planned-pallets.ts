import { z } from "zod";

export const dachserPalletCapacityKg = "750";
const positiveDecimal = z.string().regex(/^\d+(?:\.\d{1,3})?$/);

/** Uses integer milligrams to preserve the approved decimal ceiling rule. */
export function calculatePlannedPalletUnit(weightKg: string | null | undefined): number | null {
  if (!weightKg || !positiveDecimal.safeParse(weightKg).success) return null;
  const [whole, fraction = ""] = weightKg.split(".");
  const milligrams = Number(whole) * 1000 + Number((fraction + "000").slice(0, 3));
  if (!Number.isSafeInteger(milligrams) || milligrams <= 0) return null;
  return Math.ceil(milligrams / 750000);
}
