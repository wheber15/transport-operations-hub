export const importTypes = ["deliveryReference", "operationalSchedule"] as const;
export type ImportType = (typeof importTypes)[number];

export const importBatchStatuses = ["uploaded", "previewed", "committed", "failed"] as const;
export type ImportBatchStatus = (typeof importBatchStatuses)[number];

export const importRowClassifications = [
  "validUpdate",
  "unchanged",
  "conflict",
  "missingRequiredValue",
  "invalidIdentifier",
  "invalidDate",
  "invalidWeight",
  "duplicateRow",
  "unsupportedField",
  "relatedRecordNotFound",
  "unavailableRecord",
] as const;
export type ImportRowClassification = (typeof importRowClassifications)[number];

export const importLimits = {
  maxFileBytes: 10 * 1024 * 1024,
  maxRows: 10_000,
  maxColumns: 100,
  maxCellLength: 2_000,
  maxHeaderRow: 20,
} as const;

export const dataImportRoles = ["Administrator", "Planner"] as const;
export const importFieldAliases = {
  deliveryNumber: ["delivery", "delivery no", "delivery number", "deliv.", "sap delivery"],
  orderNumber: ["origindoc.", "origin document", "sales order", "order number"],
  shipToNumber: ["ship-to", "ship to", "shipto", "customer number"],
  routeCode: ["route", "route code"],
  goodsIssueDate: ["goods issue", "gi date", "goods issue date"],
  grossWeightKg: ["gross weight", "weight", "gross wt"],
  scheduledDispatchDate: ["dispatch date", "scheduled date", "delivery date", "planned dispatch"],
} as const;
