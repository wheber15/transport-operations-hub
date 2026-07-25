import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";

const findMany = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/prisma", () => ({
  prisma: { delivery: { findMany } },
}));

import { listSourceDeliveries } from "./carrier-export-repository";

function linkedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "SO-001",
    shipToNumber: "SHIP-1",
    shipToName2: "Dock 1",
    shipToStreet: "Main Street",
    shipToCity: "Dublin",
    shipToPostalCode: "D01",
    shipToRegion: "Leinster",
    grossWeightKg: new Prisma.Decimal("1000.000"),
    goodsIssueDate: new Date("2026-07-24T00:00:00.000Z"),
    deletedAt: null,
    customer: { id: "customer-1", name: "Customer", deletedAt: null },
    ...overrides,
  };
}

function delivery(orders: ReturnType<typeof linkedOrder>[]) {
  return {
    id: "delivery-1",
    deliveryNumber: "DEL-001",
    deletedAt: null,
    orderLinks: orders.map((order) => ({ order })),
  };
}

describe("Carrier Export Delivery aggregation", () => {
  it("creates one row for two linked Orders using their exact Decimal sum and stable order numbers", async () => {
    findMany.mockResolvedValueOnce([
      delivery([
        linkedOrder({
          id: "order-2",
          orderNumber: "SO-002",
          grossWeightKg: new Prisma.Decimal("750.001"),
        }),
        linkedOrder(),
      ]),
    ]);

    const [result] = (await listSourceDeliveries("2026-07-24")).sources;

    expect(result.linkedOrderCount).toBe(2);
    expect(result.linkedOrderNumbers).toEqual(["SO-001", "SO-002"]);
    expect(result.row.salesOrderNumber).toBe("SO-001, SO-002");
    expect(result.row.totalWeightKg).toBe("1750.001");
    expect(result.blockers).toEqual([]);
  });

  it("deduplicates duplicate links defensively instead of multiplying an Order weight", async () => {
    const duplicate = linkedOrder();
    findMany.mockResolvedValueOnce([delivery([duplicate, duplicate])]);

    const [result] = (await listSourceDeliveries("2026-07-24")).sources;

    expect(result.linkedOrderCount).toBe(1);
    expect(result.row.totalWeightKg).toBe("1000.000");
  });

  it("reports active-record blockers and excludes unavailable linked Orders", async () => {
    findMany.mockResolvedValueOnce([
      delivery([]),
      delivery([linkedOrder({ id: "unavailable", deletedAt: new Date() })]),
      delivery([linkedOrder({ id: "bad-weight", grossWeightKg: new Prisma.Decimal("0.000") })]),
      delivery([
        linkedOrder(),
        linkedOrder({
          id: "po-conflict",
          orderNumber: "SO-002",
          goodsIssueDate: new Date("2026-07-25T00:00:00.000Z"),
          shipToNumber: "SHIP-2",
          customer: { id: "customer-2", name: "Other", deletedAt: null },
          shipToCity: "Cork",
        }),
      ]),
    ]);

    const sourceResult = await listSourceDeliveries("2026-07-24");
    const results = sourceResult.sources;
    const codes = results.flatMap((result) => result.blockers.map((blocker) => blocker.code));

    expect(codes).toEqual(
      expect.arrayContaining([
        "MISSING_LINKED_ORDERS",
        "INVALID_LINKED_WEIGHT",
        "CONFLICTING_GOODS_ISSUE_DATE",
        "CONFLICTING_SHIP_TO",
        "CONFLICTING_SOLD_TO",
        "CONFLICTING_DESTINATION",
      ])
    );
    expect(sourceResult.excluded.inactiveLinkedOrders).toBe(1);
  });

  it("excludes soft-deleted Deliveries and any active Delivery with an inactive linked Order", async () => {
    findMany.mockResolvedValueOnce([
      { ...delivery([linkedOrder()]), id: "deleted-delivery", deletedAt: new Date() },
      delivery([linkedOrder({ id: "active-order" }), linkedOrder({ id: "deleted-order", deletedAt: new Date() })]),
    ]);

    const result = await listSourceDeliveries("2026-07-24");

    expect(result.sources).toEqual([]);
    expect(result.excluded).toEqual({
      inactiveDeliveries: 1,
      inactiveLinkedOrders: 1,
      mixedLinkedOrderStates: 1,
    });
  });

  it("queries both the legacy primary Order and DeliveryOrderLinks for the requested business date", async () => {
    findMany.mockResolvedValueOnce([]);

    await listSourceDeliveries("2026-07-24");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ order: expect.anything() }),
            expect.objectContaining({ orderLinks: expect.anything() }),
          ]),
        }),
      })
    );
  });
});
