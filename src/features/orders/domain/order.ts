export const orderSortFields = [
  "orderNumber",
  "customer",
  "pickingNumber",
  "goodsIssueDate",
] as const;

export type OrderSortField = (typeof orderSortFields)[number];

export type OrderSortDirection = "asc" | "desc";

export type OrderSearchFilters = {
  page: number;
  pageSize: number;
  query?: string;
  sortBy: OrderSortField;
  sortDirection: OrderSortDirection;
  datePreset: "today" | "yesterday" | "thisWeek" | "all" | "custom";
  goodsIssueFrom?: string;
  goodsIssueTo?: string;
  customer?: string;
  route?: string;
  shipTo?: string;
  shipmentState?: "all" | "assigned" | "unassigned";
  palletState?: "all" | "awaiting" | "captured";
  status?: string;
  recordState?: "active" | "deleted" | "all";
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  pickingNumber: string | null;
  goodsIssueDate: Date | null;
  customerName: string | null;
  salesRepName: string | null;
  shipToNumber: string | null;
  routeCode: string | null;
  grossWeightKg: string | null;
  estimatedPalletCount: number | null;
  deliveryNumber: string | null;
  deliveryId: string | null;
  shipmentNumber: string | null;
  actualPalletCount: number | null;
  actualPalletWeightKg: string | null;
  weightVarianceKg: string | null;
  palletStatus: "awaitingActual" | "captured" | "matches" | "under" | "over";
};

export type OrderDetail = OrderListItem & {
  createdAt: Date;
  createdByName: string | null;
  updatedAt: Date;
  updatedByName: string | null;
  deliveries: Array<{
    id: string;
    deliveryNumber: string;
    actualPalletCount: number | null;
    actualPalletWeightKg: string | null;
    weightVarianceKg: string | null;
    palletStatus: "awaitingActual" | "captured" | "matches" | "under" | "over";
    shipmentNumber: string | null;
  }>;
};

export type OrdersSummary = { orders: number; deliveries: number; assignedToShipment: number; awaitingActualPalletData: number };

export type OrderActivityEvent = {
  actorId: string;
  orderId: string;
  action: "created" | "updated";
};

export type OrderActivityRecorder = {
  record(event: OrderActivityEvent): Promise<void>;
};
