export type OrdersLeftRow = {
  customerName: string;
  deliveryNumber: string;
  weightKg: string | null;
};

export type OrdersLeftWorkbookRow = OrdersLeftRow & {
  calculatedPallets: number | null;
};
