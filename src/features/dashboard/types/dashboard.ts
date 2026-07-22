export type DashboardOrder = {
  actualPalletCount: number | null;
  assignmentStatus: "assigned" | "unassigned";
  customerName: string | null;
  deliveryId: string | null;
  deliveryNumber: string | null;
  estimatedPalletCount: number | null;
  grossWeightKg: string | null;
  palletDataStatus: "awaiting" | "captured";
  routeCode: string | null;
  salesOrderId: string;
  salesOrderNumber: string;
  shipmentNumber: string | null;
  shipToNumber: string | null;
  weightStatus: "awaiting" | "under" | "exact" | "over" | "unavailable";
};

export type DashboardRemainingOrder = DashboardOrder & {
  additionalIssueCount: number;
  reason:
    | "Awaiting pallet data"
    | "Not assigned"
    | "Over SAP weight"
    | "Under SAP weight"
    | "Missing planning data";
};

export type DashboardShipment = {
  carrierName: string | null;
  deliveryCount: number;
  dispatchDate: Date | null;
  id: string;
  palletCount: number;
  shipmentNumber: string;
};

export type DashboardTodaySummary = {
  assigned: number;
  awaitingPalletData: number;
  exactWeight: number;
  overWeight: number;
  remaining: number;
  todayOrders: number;
  underWeight: number;
  unassigned: number;
};

export type DashboardData = {
  recentShipments: DashboardShipment[];
  remainingToday: DashboardRemainingOrder[];
  todayOrders: DashboardOrder[];
  todaySummary: DashboardTodaySummary;
};
