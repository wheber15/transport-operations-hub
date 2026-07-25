export const roleNames = {
  administrator: "Administrator",
  planner: "Planner",
} as const;

export type RoleName = (typeof roleNames)[keyof typeof roleNames];

export const deliveryAssignmentRoles = [roleNames.administrator, roleNames.planner] as const;

export const deliveryImportRoles = deliveryAssignmentRoles;
export const dataImportRoles = deliveryAssignmentRoles;
export const carrierExportRoles = deliveryAssignmentRoles;

export function canManageDeliveryAssignments(role: string | null) {
  return deliveryAssignmentRoles.includes(role as (typeof deliveryAssignmentRoles)[number]);
}

export function canManageDeliveryImports(role: string | null) {
  return deliveryImportRoles.includes(role as (typeof deliveryImportRoles)[number]);
}

export function canManageDataImports(role: string | null) {
  return dataImportRoles.includes(role as (typeof dataImportRoles)[number]);
}

export function canManageCarriers(role: string | null) {
  return role === roleNames.administrator;
}

export function canManageCarrierExports(role: string | null) {
  return carrierExportRoles.includes(role as (typeof carrierExportRoles)[number]);
}

export function canMarkCarrierExportsSent(role: string | null) {
  return role === roleNames.administrator;
}
