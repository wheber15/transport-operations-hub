export type DeliveryLinkedOrder = {
  id: string;
  orderNumber: string;
  isPrimary: boolean;
  purchaseOrderNumber: string | null;
  grossWeightKg: string | null;
  goodsIssueDate: Date | null;
  sapGoodsIssueDate: Date | null;
  shipToNumber: string | null;
  deletedAt: Date | null;
};

export type DeliveryDetail = {
  id: string;
  deliveryNumber: string;
  shipmentNumber: string | null;
  linkedOrders: DeliveryLinkedOrder[];
};
