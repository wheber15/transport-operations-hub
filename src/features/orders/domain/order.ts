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
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  pickingNumber: string | null;
  goodsIssueDate: Date | null;
  customerName: string | null;
  salesRepName: string | null;
};

export type OrderDetail = OrderListItem & {
  createdAt: Date;
  createdByName: string | null;
  updatedAt: Date;
  updatedByName: string | null;
  deliveries: Array<{
    id: string;
    deliveryNumber: string;
  }>;
};

export type OrderActivityEvent = {
  actorId: string;
  orderId: string;
  action: "created" | "updated";
};

export type OrderActivityRecorder = {
  record(event: OrderActivityEvent): Promise<void>;
};
