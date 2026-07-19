import { z } from "zod";

import type { DeliveryImportDuplicate } from "@/features/shipments/types/shipment";

const maximumUniqueDeliveryNumbers = 200;
const internalUuidSchema = z.string().uuid();

export class DeliveryImportValidationError extends Error {}

export type NormalizedDeliveryNumbers = {
  duplicates: DeliveryImportDuplicate[];
  requestedCount: number;
  uniqueNumbers: string[];
};

function assertPlannerFacingDeliveryNumber(value: string) {
  if (internalUuidSchema.safeParse(value).success) {
    throw new DeliveryImportValidationError("Delivery numbers must use SAP identifiers.");
  }
}

function normalizeValues(values: string[]): NormalizedDeliveryNumbers {
  const counts = new Map<string, number>();
  const uniqueNumbers: string[] = [];

  for (const value of values) {
    const deliveryNumber = value.trim();
    if (!deliveryNumber) continue;
    assertPlannerFacingDeliveryNumber(deliveryNumber);
    const count = counts.get(deliveryNumber) ?? 0;
    counts.set(deliveryNumber, count + 1);
    if (count === 0) uniqueNumbers.push(deliveryNumber);
  }

  if (uniqueNumbers.length === 0) {
    throw new DeliveryImportValidationError("Provide at least one SAP Delivery Number.");
  }
  if (uniqueNumbers.length > maximumUniqueDeliveryNumbers) {
    throw new DeliveryImportValidationError("A maximum of 200 unique Delivery Numbers is allowed.");
  }

  return {
    requestedCount: values.filter((value) => value.trim().length > 0).length,
    uniqueNumbers,
    duplicates: [...counts]
      .filter(([, occurrences]) => occurrences > 1)
      .map(([deliveryNumber, occurrences]) => ({ deliveryNumber, occurrences })),
  };
}

export function normalizePastedDeliveryNumbers(rawInput: string): NormalizedDeliveryNumbers {
  return normalizeValues(rawInput.split(/[\s,;]+/));
}

export function normalizeCommittedDeliveryNumbers(values: string[]): NormalizedDeliveryNumbers {
  return normalizeValues(values);
}
