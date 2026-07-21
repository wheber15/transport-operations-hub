export const importClassificationLabels = {
  validUpdate: "Ready to update",
  unchanged: "No change",
  conflict: "Conflict",
  missingRequiredValue: "Missing value",
  invalidIdentifier: "Invalid identifier",
  invalidDate: "Invalid date",
  invalidWeight: "Invalid weight",
  duplicateRow: "Duplicate row",
  unsupportedField: "Unsupported value",
  relatedRecordNotFound: "Delivery not found",
  unavailableRecord: "Record unavailable",
  readyToCreate: "Ready to create",
  readyToUpdate: "Ready to update",
  missingDetailRow: "Missing detail row",
  conflictingDetailData: "Conflicting detail data",
  duplicateDelivery: "Duplicate Delivery",
  alreadyAssignedToShipment: "Already assigned to Shipment",
  requiresReview: "Requires review",
} as const;

export type ImportClassification = keyof typeof importClassificationLabels;

export function getImportClassificationLabel(value: string) {
  return importClassificationLabels[value as ImportClassification] ?? "Unavailable";
}

export function formatSapWeight(value: string | null | undefined) {
  if (!value) return null;
  const [whole, decimal = ""] = value.split(".");
  return `${whole}.${decimal.padEnd(3, "0").slice(0, 3)} kg`;
}
