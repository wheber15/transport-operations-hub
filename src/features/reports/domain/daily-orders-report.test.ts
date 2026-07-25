import { describe, expect, it } from "vitest";

import {
  calculateDailyOrdersKpis,
  createDailyOrdersExceptions,
  planTrailers,
  type DailyOrdersReportRow,
} from "./daily-orders-report";

const baseRow: DailyOrdersReportRow = {
  deliveryId: "delivery-1",
  deliveryNumber: "9108325191",
  orderId: "order-1",
  orderNumber: "1046262594",
  customerName: "Woodies",
  shipToNumber: "85287",
  routeCode: "IE1211",
  goodsIssueDate: new Date("2026-07-22T00:00:00.000Z"),
  orderSapWeightKg: "1000.000",
  orderEstimatedPallets: 2,
  isOrderPrimaryRow: true,
  activeDeliveryCountForOrder: 1,
  actualWeightKg: "950.000",
  actualPallets: 2,
  weightVarianceKg: "-50.000",
  palletVariance: 0,
  shipmentNumber: null,
  shipmentId: null,
  shipmentDeliveryDate: null,
  shipmentIsActive: false,
  carrierName: null,
  assignmentStatus: "awaitingShipment",
  palletStatus: "captured",
  hasActualWeight: true,
};

describe("Daily Orders report calculations", () => {
  it("uses order-level planned values once while retaining delivery-grain actual data", () => {
    const primaryDelivery = { ...baseRow, activeDeliveryCountForOrder: 2 };
    const secondDelivery = {
      ...baseRow,
      deliveryId: "delivery-2",
      deliveryNumber: "9108325192",
      isOrderPrimaryRow: false,
      activeDeliveryCountForOrder: 2,
      actualWeightKg: "400.000",
      actualPallets: 1,
      weightVarianceKg: null,
      palletVariance: null,
    };
    const { kpis } = calculateDailyOrdersKpis(
      [primaryDelivery, secondDelivery],
      1,
      26,
      "2026-07-23"
    );
    expect(kpis.totalSapWeightKg).toBe("1000.000");
    expect(kpis.estimatedPallets).toBe(2);
    expect(kpis.totalActualWeightKg).toBe("1350.000");
    expect(kpis.weightVarianceKg).toBeNull();
    expect(kpis.totalDeliveries).toBe(2);
  });

  it("keeps a repeated Order contribution singular when the same Order is associated with multiple Deliveries", () => {
    const rows = [
      {
        ...baseRow,
        deliveryId: "delivery-1",
        deliveryNumber: "DEL-001",
        isOrderPrimaryRow: true,
        activeDeliveryCountForOrder: 3,
      },
      {
        ...baseRow,
        deliveryId: "delivery-2",
        deliveryNumber: "DEL-002",
        isOrderPrimaryRow: false,
        activeDeliveryCountForOrder: 3,
      },
      {
        ...baseRow,
        deliveryId: "delivery-3",
        deliveryNumber: "DEL-003",
        isOrderPrimaryRow: false,
        activeDeliveryCountForOrder: 3,
      },
    ];

    const { kpis } = calculateDailyOrdersKpis(rows, 1, 26, "2026-07-23");

    expect(kpis.totalSapWeightKg).toBe("1000.000");
    expect(kpis.estimatedPallets).toBe(2);
    expect(kpis.totalDeliveries).toBe(3);
  });

  it("reports zero, exact, and capacity-plus-one trailer guidance", () => {
    expect(planTrailers(0)).toMatchObject({
      trailersRequired: 0,
      plannedCapacity: 0,
      unusedCapacity: 0,
    });
    expect(planTrailers(26)).toMatchObject({
      trailersRequired: 1,
      breakdown: [26],
      unusedCapacity: 0,
    });
    expect(planTrailers(27)).toMatchObject({
      trailersRequired: 2,
      breakdown: [26, 1],
      unusedCapacity: 25,
    });
  });

  it("creates deterministic overdue and awaiting-shipment exceptions", () => {
    const exceptions = createDailyOrdersExceptions(
      [{ ...baseRow, palletStatus: "awaiting", actualWeightKg: null, hasActualWeight: false }],
      "2026-07-23"
    );
    expect(exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "High", category: "Overdue" }),
        expect.objectContaining({ severity: "High", category: "Awaiting Shipment" }),
        expect.objectContaining({ severity: "Medium", category: "Awaiting pallet data" }),
      ])
    );
  });
});
