import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

import { replaceDeliveryPallets } from "./pallet-repository";

const actor = { id: "11111111-1111-4111-8111-111111111111" };
const deliveryId = "22222222-2222-4222-8222-222222222222";
const existingPallet = {
  id: "33333333-3333-4333-8333-333333333333",
  sequenceNumber: 1,
  actualWeight: { toFixed: vi.fn(() => "420.000") },
  note: null,
};

function workspaceRecord(weights: string[] = ["420.000"]) {
  return {
    id: deliveryId,
    deliveryNumber: "9108325190",
    updatedAt: new Date("2026-07-21T12:00:00.000Z"),
    order: {
      orderNumber: "1046227772",
      grossWeightKg: { toFixed: vi.fn(() => "1200.000") },
      customer: { name: "Example customer" },
    },
    pallets: weights.map((actualWeight, index) => ({
      id: `${index + 4}3333333-3333-4333-8333-333333333333`.slice(0, 36),
      sequenceNumber: index + 1,
      actualWeight: { toFixed: vi.fn(() => actualWeight) },
      note: null,
    })),
  };
}

function transactionMock(overrides?: Partial<Record<string, unknown>>) {
  return {
    delivery: {
      findFirst: vi.fn().mockResolvedValue({
        id: deliveryId,
        deliveryNumber: "9108325190",
        updatedAt: new Date("2026-07-21T12:00:00.000Z"),
      }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(workspaceRecord()),
    },
    pallet: {
      findMany: vi.fn().mockResolvedValue([existingPallet]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    activity: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

describe("pallet replacement repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-deletes the active set, creates a replacement, and returns the recalculated workspace", async () => {
    const tx = transactionMock();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await replaceDeliveryPallets(actor, deliveryId, {
      pallets: [
        { id: existingPallet.id, sequenceNumber: 1, actualWeightKg: "420", note: null },
        { sequenceNumber: 2, actualWeightKg: "395", note: null },
      ],
    });

    expect(tx.pallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deliveryId, deletedAt: null },
        data: expect.objectContaining({ updatedById: actor.id }),
      })
    );
    expect(tx.pallet.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ actualWeight: "420", createdById: actor.id }),
        ]),
      })
    );
    expect(tx.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actualPalletCount: 2 }),
      })
    );
    expect(tx.activity.create).toHaveBeenCalledTimes(1);
    expect(result?.summary).toEqual(
      expect.objectContaining({ palletCount: 1, status: "captured" })
    );
  });

  it("clears the active set without creating rows", async () => {
    const tx = transactionMock({
      delivery: {
        ...transactionMock().delivery,
        findUnique: vi.fn().mockResolvedValue(workspaceRecord([])),
      },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await replaceDeliveryPallets(actor, deliveryId, { pallets: [] });

    expect(tx.pallet.createMany).not.toHaveBeenCalled();
    expect(tx.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actualPalletCount: null }),
      })
    );
    expect(result?.summary.status).toBe("awaitingActual");
  });

  it("rejects a stale or inactive Delivery before writing pallets", async () => {
    const stale = transactionMock();
    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(stale));
    await expect(
      replaceDeliveryPallets(actor, deliveryId, {
        updatedAt: "2026-07-21T11:59:59.000Z",
        pallets: [{ sequenceNumber: 1, actualWeightKg: "420" }],
      })
    ).rejects.toThrow("STALE_RECORD");
    expect(stale.pallet.updateMany).not.toHaveBeenCalled();

    const inactive = transactionMock({ delivery: { findFirst: vi.fn().mockResolvedValue(null) } });
    prismaMock.$transaction.mockImplementationOnce(async (callback) => callback(inactive));
    await expect(replaceDeliveryPallets(actor, deliveryId, { pallets: [] })).resolves.toBeNull();
  });

  it("lets an Activity failure abort the transaction callback", async () => {
    const tx = transactionMock({
      activity: { create: vi.fn().mockRejectedValue(new Error("activity failure")) },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await expect(
      replaceDeliveryPallets(actor, deliveryId, {
        pallets: [{ sequenceNumber: 1, actualWeightKg: "420" }],
      })
    ).rejects.toThrow("activity failure");
  });
});
