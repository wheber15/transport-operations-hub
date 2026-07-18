export const roleNames = {
  administrator: "Administrator",
  planner: "Planner",
} as const;

export type RoleName = (typeof roleNames)[keyof typeof roleNames];
