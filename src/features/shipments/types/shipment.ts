export const shipmentSortFields = [
  "shipmentNumber",
  "carrier",
  "dispatchDate",
  "deliveryDate",
  "actualPallets",
  "actualWeight",
  "deliveryCount",
] as const;

export type ShipmentSortField = (typeof shipmentSortFields)[number];

export type ShipmentSortDirection = "asc" | "desc";

export type ShipmentSearchFilters = {
  page: number;
  pageSize: number;
  query?: string;
  sortBy: ShipmentSortField;
  sortDirection: ShipmentSortDirection;
};

export type ShipmentListItem = {
  id: string;
  shipmentNumber: string;
  carrierName: string | null;
  dispatchDate: Date | null;
  deliveryDate: Date | null;
  actualPallets: number | null;
  actualWeight: string | null;
  deliveryCount: number;
};

export type ShipmentDelivery = {
  id: string;
  deliveryNumber: string;
  orderNumber: string;
};

export type AvailableDeliveryList = {
  items: ShipmentDelivery[];
  hasMore: boolean;
};

export type ShipmentDetail = ShipmentListItem & {
  notes: string | null;
  createdAt: Date;
  createdByName: string | null;
  updatedAt: Date;
  updatedByName: string | null;
};

export type ShipmentActivityEvent = {
  actorId: string;
  shipmentId: string;
  action: "created" | "updated";
};

export type ShipmentActivityRecorder = {
  record(event: ShipmentActivityEvent): Promise<void>;
};
