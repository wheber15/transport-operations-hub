import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardWorkspace } from "./dashboard-workspace";
import { getDashboardDeliveryHref } from "@/features/dashboard/lib/delivery-navigation";
import type { DashboardData, DashboardOrder } from "@/features/dashboard/types/dashboard";

const order: DashboardOrder = {
  actualPalletCount: null,
  assignmentStatus: "unassigned",
  customerName: "WOODIES MULLINGAR",
  deliveryId: "delivery-85287",
  deliveryNumber: "9108325191",
  estimatedPalletCount: 1,
  grossWeightKg: "1500.000",
  palletDataStatus: "awaiting",
  routeCode: "IE1211",
  salesOrderId: "order-1046262594",
  salesOrderNumber: "1046262594",
  shipmentNumber: null,
  shipToNumber: "85287",
  weightStatus: "awaiting",
};

const data: DashboardData = {
  recentShipments: [],
  remainingToday: [{ ...order, additionalIssueCount: 1, reason: "Awaiting pallet data" }],
  todayOrders: [order],
  todaySummary: {
    assigned: 0,
    awaitingPalletData: 1,
    exactWeight: 0,
    overWeight: 0,
    remaining: 1,
    todayOrders: 1,
    underWeight: 0,
    unassigned: 1,
  },
};

describe("Dashboard delivery identifiers", () => {
  it("renders the Delivery Number as the primary identifier in both operational cards", () => {
    const markup = renderToStaticMarkup(<DashboardWorkspace data={data} />);

    expect(markup.match(/Delivery 9108325191/g)).toHaveLength(2);
    expect(markup).toContain("Order 1046262594");
    expect(markup).toContain("Unassigned");
    expect(markup).toContain("Awaiting pallet data");
  });

  it("links a Delivery Number to its anchored parent Order detail", () => {
    const href = getDashboardDeliveryHref(order);
    expect(href).toBe("/orders/order-1046262594#delivery-delivery-85287");

    const markup = renderToStaticMarkup(<DashboardWorkspace data={data} />);
    expect(markup).toContain(`href="${href}"`);
  });

  it("shows a visible safe fallback when an Order has no Delivery", () => {
    const markup = renderToStaticMarkup(
      <DashboardWorkspace
        data={{ ...data, todayOrders: [{ ...order, deliveryId: null, deliveryNumber: null }] }}
      />
    );

    expect(markup).toContain("Delivery unavailable");
    expect(getDashboardDeliveryHref({ ...order, deliveryId: null })).toBeNull();
  });
});
