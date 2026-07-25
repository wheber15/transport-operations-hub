import "server-only";

/**
 * Export-only Order columns are enabled only after their additive migration is applied.
 * This keeps established Orders queries compatible with databases that predate the fields.
 */
export function areOrderExportFieldsAvailable(environment = process.env) {
  return environment.ORDER_EXPORT_FIELDS_AVAILABLE === "true";
}
