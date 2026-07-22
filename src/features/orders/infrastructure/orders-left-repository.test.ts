import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ delivery: { findMany: vi.fn() } }));
vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

import { listOrdersLeftForBusinessDate } from "./orders-left-repository";

describe("Orders left repository", () => {
  it("includes only active, unassigned Deliveries for active Orders on the requested business date", async () => {
    prismaMock.delivery.findMany.mockResolvedValue([
      {
        deliveryNumber: "002",
        order: {
          grossWeightKg: { toFixed: () => "750.000" },
          customer: { name: "Woodies", deletedAt: null },
        },
      },
      {
        deliveryNumber: "001",
        order: {
          grossWeightKg: { toFixed: () => "1.000" },
          customer: { name: "B&Q", deletedAt: null },
        },
      },
    ]);
    await expect(listOrdersLeftForBusinessDate("2026-07-22")).resolves.toMatchObject([
      { customerName: "B&Q", deliveryNumber: "001" },
      { customerName: "Woodies", deliveryNumber: "002" },
    ]);
    expect(prismaMock.delivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          shipmentId: null,
          order: expect.objectContaining({
            is: expect.objectContaining({
              deletedAt: null,
              goodsIssueDate: {
                gte: new Date("2026-07-22T00:00:00.000Z"),
                lt: new Date("2026-07-23T00:00:00.000Z"),
              },
            }),
          }),
        }),
      })
    );
  });
});
