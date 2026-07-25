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
  deliveryNotFound: "Delivery not found",
  originatingOrderNotFound: "Originating Order not found",
  relatedRecordNotFound: "Delivery not found",
  unavailableRecord: "Record unavailable",
  readyToCreate: "Ready to create",
  readyToCreateWithDateOverride: "Date override acknowledged — ready to create",
  readyToUpdate: "Ready to update",
  readyToUpdateWithDateOverride: "Date override acknowledged — ready to update",
  unchangedWithDateOverride: "Date override acknowledged — no other change",
  dateMismatchRequiresAcknowledgement: "Date mismatch requires acknowledgement",
  missingSapDate: "Missing or invalid SAP Goods Issue Date",
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
