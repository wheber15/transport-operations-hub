export type DashboardOrder = {
  customerName: string | null;
  goodsIssueDate: Date | null;
  orderNumber: string;
  salesRepName: string | null;
};

export type DashboardShipment = {
  carrierName: string | null;
  deliveryCount: number;
  dispatchDate: Date | null;
  id: string;
  shipmentNumber: string;
};

export type DashboardActivity = {
  action: string;
  actorName: string | null;
  description: string;
  occurredAt: Date;
};

export type DashboardCustomerAttention = {
  customerName: string;
  salesRepName: string | null;
};

export type DashboardSummary = {
  carriers: number;
  customers: number;
  orders: number;
  salesReps: number;
  shipments: number;
};

export type DashboardData = {
  customersRequiringAttention: DashboardCustomerAttention[];
  recentActivity: DashboardActivity[];
  recentShipments: DashboardShipment[];
  summary: DashboardSummary;
  todaysOrders: DashboardOrder[];
};
