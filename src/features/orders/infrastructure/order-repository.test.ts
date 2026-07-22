import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

import { buildOrdersWhere, listOrders } from "./order-repository";

const baseOrder = {
  id: "2dc5ad51-7c13-47c2-9e49-0c934f2454d6",
  orderNumber: "1046227772",
  pickingNumber: "PICK-001",
  goodsIssueDate: new Date("2026-07-21T00:00:00.000Z"),
  shipToNumber: "0000123456",
  routeCode: "IE1211",
  grossWeightKg: { toFixed: vi.fn(() => "32.620") },
  customer: {
    name: "Example customer",
    deletedAt: null,
    salesRep: { name: "Example representative", deletedAt: null },
  },
};

function orderWithPalletWeights(weights: string[]) {
  return {
    ...baseOrder,
    deliveries: [
      {
        id: "39678018-db17-4239-bf3d-c27af809d6a5",
        deliveryNumber: "9108325190",
        shipment: null,
        pallets: weights.map((weight) => ({ actualWeight: { toFixed: vi.fn(() => weight) } })),
      },
    ],
  };
}

describe("order repository pallet counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.order.findMany.mockImplementation((operation) => operation);
    prismaMock.order.count.mockImplementation((operation) => operation);
  });

  it.each([
    [[], null],
    [["8.000"], 1],
    [["8.250", "7.940", "9.110", "7.320"], 4],
  ])("derives the active pallet count %s", async (
    palletWeights,
    expectedValue
  ) => {
    prismaMock.$transaction.mockResolvedValue([[orderWithPalletWeights(palletWeights)], 1]);

    const result = await listOrders({
      page: 1,
      pageSize: 25,
      sortBy: "orderNumber",
      sortDirection: "asc",
      datePreset: "all",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.actualPalletCount).toBe(expectedValue);
  });

  it("selects active Pallet rows rather than the legacy Delivery count cache", async () => {
    prismaMock.$transaction.mockResolvedValue([[orderWithPalletWeights([])], 1]);

    await listOrders({
      page: 1,
      pageSize: 25,
      sortBy: "orderNumber",
      sortDirection: "asc",
      datePreset: "all",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          select: expect.objectContaining({
            deliveries: expect.objectContaining({
              select: expect.objectContaining({
                pallets: expect.objectContaining({ select: { actualWeight: true } }),
              }),
            }),
          }),
        }),
      ])
    );
  });

  it("filters Goods Issue Date to the Tomorrow scope", () => {
    expect(
      buildOrdersWhere({
        page: 1,
        pageSize: 25,
        sortBy: "goodsIssueDate",
        sortDirection: "asc",
        datePreset: "tomorrow",
        goodsIssueFrom: "2026-07-23",
        goodsIssueTo: "2026-07-23",
      })
    ).toMatchObject({
      deletedAt: null,
      goodsIssueDate: {
        gte: new Date("2026-07-23T00:00:00.000Z"),
        lte: new Date("2026-07-23T00:00:00.000Z"),
      },
    });
  });
});
