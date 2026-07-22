import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/prisma", () => ({ prisma: {} }));

import { getRemainingTodayOrder } from "./dashboard-repository";

const base = {
  salesOrderId: "1",
  salesOrderNumber: "1046227772",
  deliveryId: "delivery-1",
  deliveryNumber: "9108325191",
  customerName: "Customer",
  shipToNumber: "0001",
  routeCode: "IE1211",
  grossWeightKg: "1220.000",
  estimatedPalletCount: 2,
  actualPalletCount: 3,
  shipmentNumber: "SHP-1",
  assignmentStatus: "assigned" as const,
  palletDataStatus: "captured" as const,
  weightStatus: "exact" as const,
};

describe("dashboard remaining-today rule", () => {
  it("does not treat an exact, captured, assigned Order with planning data as remaining", () => {
    expect(getRemainingTodayOrder(base)).toBeNull();
  });
  it("prioritises awaiting pallet data before other issues without duplicating an Order", () => {
    expect(
      getRemainingTodayOrder({
        ...base,
        palletDataStatus: "awaiting",
        assignmentStatus: "unassigned",
        weightStatus: "awaiting",
      })
    ).toEqual(expect.objectContaining({ reason: "Awaiting pallet data", additionalIssueCount: 1 }));
  });
  it.each(["under", "over"] as const)(
    "surfaces %s SAP weight as a remaining reason",
    (weightStatus) => {
      expect(getRemainingTodayOrder({ ...base, weightStatus })).toEqual(
        expect.objectContaining({
          reason: weightStatus === "under" ? "Under SAP weight" : "Over SAP weight",
        })
      );
    }
  );
});
