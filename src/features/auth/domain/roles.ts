export const roleNames = {
  administrator: "Administrator",
  planner: "Planner",
} as const;

export type RoleName = (typeof roleNames)[keyof typeof roleNames];

export const deliveryAssignmentRoles = [roleNames.administrator, roleNames.planner] as const;

export function canManageDeliveryAssignments(role: string | null) {
  return deliveryAssignmentRoles.includes(role as (typeof deliveryAssignmentRoles)[number]);
}
