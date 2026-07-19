import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  importRow: { updateMany: vi.fn() },
  importBatch: { deleteMany: vi.fn() },
}));

vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

import {
  commitBatch,
  deleteAbandonedBatches,
  purgeExpiredImportPayloads,
} from "./data-import-repository";

const actorId = "11111111-1111-4111-8111-111111111111";
const batchId = "22222222-2222-4222-8222-222222222222";
const delivery = {
  id: "33333333-3333-4333-8333-333333333333",
  orderId: "44444444-4444-4444-8444-444444444444",
};

function transactionMock(overrides?: Partial<Record<string, unknown>>) {
  return {
    importBatch: {
      findFirst: vi.fn().mockResolvedValue({
        id: batchId,
        status: "previewed",
        importType: "deliveryReference",
        originalFileName: "import.xlsx",
        rows: [
          {
            id: "row",
            identifier: "000123",
            classification: "validUpdate",
            proposedValues: {
              goodsIssueDate: "2024-01-01",
              shipToNumber: "000045",
              routeCode: "IE1211",
              grossWeightKg: "7.000",
            },
          },
        ],
      }),
      update: vi.fn().mockResolvedValue({ status: "committed", importedRows: 1, skippedRows: 0 }),
    },
    delivery: { findFirst: vi.fn().mockResolvedValue(delivery) },
    order: { update: vi.fn().mockResolvedValue({}) },
    operationalSchedule: { upsert: vi.fn().mockResolvedValue({}) },
    importRow: { update: vi.fn().mockResolvedValue({}) },
    activity: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

describe("import commit repository", () => {
  beforeEach(() => vi.clearAllMocks());
  it("updates only approved Order fields and leaves delivery and shipment relations untouched", async () => {
    const tx = transactionMock();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await commitBatch(batchId, actorId);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: delivery.orderId },
        data: expect.objectContaining({
          updatedById: actorId,
          shipToNumber: "000045",
          routeCode: "IE1211",
        }),
      })
    );
    expect(tx.delivery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deliveryNumber: "000123", deletedAt: null }),
      })
    );
    expect(tx.activity.create).toHaveBeenCalledTimes(1);
  });
  it("skips an unavailable delivery that became stale after preview", async () => {
    const tx = transactionMock({ delivery: { findFirst: vi.fn().mockResolvedValue(null) } });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await commitBatch(batchId, actorId);
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.importRow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ classification: "unavailableRecord" }),
      })
    );
  });
  it("rejects commits before preview and repeat commits", async () => {
    const tx = transactionMock({
      importBatch: { findFirst: vi.fn().mockResolvedValue({ status: "committed" }) },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await expect(commitBatch(batchId, actorId)).rejects.toThrow("not ready");
  });
  it("rolls back when Activity creation fails", async () => {
    const tx = transactionMock({
      activity: { create: vi.fn().mockRejectedValue(new Error("activity failure")) },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await expect(commitBatch(batchId, actorId)).rejects.toThrow("activity failure");
  });
  it("selects only eligible retention records", async () => {
    prismaMock.importRow.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.importBatch.deleteMany.mockResolvedValue({ count: 1 });
    const now = new Date("2026-07-19T00:00:00.000Z");
    await purgeExpiredImportPayloads(now);
    await deleteAbandonedBatches(now);
    expect(prismaMock.importRow.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          batch: expect.objectContaining({ status: { in: ["committed", "failed"] } }),
        }),
      })
    );
    expect(prismaMock.importBatch.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["uploaded", "configured"] } }),
      })
    );
  });
});
