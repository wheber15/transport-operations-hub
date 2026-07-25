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
    delivery: {
      findFirst: vi.fn().mockResolvedValue(delivery),
      create: vi.fn().mockResolvedValue(delivery),
    },
    customer: {
      findFirst: vi.fn().mockResolvedValue({ id: "customer" }),
      create: vi.fn().mockResolvedValue({ id: "customer" }),
    },
    order: {
      findFirst: vi.fn().mockResolvedValue({ id: delivery.orderId, deletedAt: null }),
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({ id: delivery.orderId }),
      create: vi.fn().mockResolvedValue({ id: delivery.orderId }),
    },
    deliveryOrderLink: { upsert: vi.fn().mockResolvedValue({}) },
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
    await expect(commitBatch(batchId, actorId)).rejects.toThrow("BATCH_ALREADY_COMMITTED");
  });
  it("updates approved SAP fields on an existing matching Order without creating records", async () => {
    const tx = transactionMock({
      importBatch: {
        findFirst: vi.fn().mockResolvedValue({
          id: batchId,
          status: "previewed",
          importType: "sapOrderBook",
          originalFileName: "order-book.xlsx",
          rows: [
            {
              id: "sap-row",
              identifier: "9100000001",
              classification: "validUpdate",
              proposedValues: {
                orderNumber: "1040000001",
                customerName: "Customer",
                grossWeightKg: "7.000",
              },
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ status: "committed", importedRows: 1, skippedRows: 0 }),
      },
      delivery: {
        findFirst: vi.fn().mockResolvedValue({
          ...delivery,
          shipmentId: "shipment-id",
          deletedAt: null,
          order: { orderNumber: "1040000001", deletedAt: null },
        }),
        create: vi.fn(),
      },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await commitBatch(batchId, actorId);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: delivery.orderId },
        data: expect.objectContaining({ grossWeightKg: expect.anything(), updatedById: actorId }),
      })
    );
    expect(tx.delivery.create).not.toHaveBeenCalled();
    expect(tx.customer.create).not.toHaveBeenCalled();
    expect(tx.order.upsert).not.toHaveBeenCalled();
    expect(tx.deliveryOrderLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ source: "SAP_IMPORT", deliveryId: delivery.id }),
      })
    );
    const orderUpdate = vi.mocked(tx.order.update).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(orderUpdate.data).not.toHaveProperty("purchaseOrderNumber");
    expect(tx.activity.create).toHaveBeenCalledTimes(1);
  });
  it("creates a missing SAP Delivery while preserving the newly resolved Order as primary", async () => {
    const tx = transactionMock({
      importBatch: {
        findFirst: vi.fn().mockResolvedValue({
          id: batchId,
          status: "previewed",
          importType: "sapOrderBook",
          originalFileName: "order-book.xlsx",
          rows: [
            {
              id: "sap-row",
              identifier: "9100000001",
              classification: "validUpdate",
              proposedValues: { orderNumber: "1040000001", grossWeightKg: "7.000" },
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ status: "committed", importedRows: 1, skippedRows: 0 }),
      },
      delivery: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(delivery) },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await commitBatch(batchId, actorId);
    expect(tx.delivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryNumber: "9100000001" }) })
    );
    expect(tx.deliveryOrderLink.upsert).toHaveBeenCalled();
  });
  it("skips a soft-deleted SAP Delivery without restoring it", async () => {
    const tx = transactionMock({
      importBatch: {
        findFirst: vi.fn().mockResolvedValue({
          id: batchId,
          status: "previewed",
          importType: "sapOrderBook",
          originalFileName: "order-book.xlsx",
          rows: [
            {
              id: "sap-row",
              identifier: "9100000001",
              classification: "validUpdate",
              proposedValues: { orderNumber: "1040000001", grossWeightKg: "7.000" },
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ status: "committed", importedRows: 0, skippedRows: 1 }),
      },
      delivery: {
        findFirst: vi.fn().mockResolvedValue({
          ...delivery,
          deletedAt: new Date("2026-07-24T00:00:00.000Z"),
          order: { orderNumber: "1040000001", deletedAt: null },
        }),
        create: vi.fn(),
      },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await commitBatch(batchId, actorId);
    expect(tx.importRow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ classification: "unavailableRecord" }),
      })
    );
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.delivery.create).not.toHaveBeenCalled();
  });
  it("links a second existing Order without changing the legacy primary Order", async () => {
    const tx = transactionMock({
      importBatch: {
        findFirst: vi.fn().mockResolvedValue({
          id: batchId,
          status: "previewed",
          importType: "sapOrderBook",
          originalFileName: "order-book.xlsx",
          rows: [
            {
              id: "sap-row",
              identifier: "9100000001",
              classification: "validUpdate",
              proposedValues: { orderNumber: "1040000001", grossWeightKg: "7.000" },
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ status: "committed", importedRows: 0, skippedRows: 1 }),
      },
      delivery: {
        findFirst: vi.fn().mockResolvedValue({
          ...delivery,
          deletedAt: null,
          order: { orderNumber: "1040000002", deletedAt: null },
        }),
        create: vi.fn(),
      },
      order: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555", deletedAt: null }),
        update: vi.fn().mockResolvedValue({}),
        upsert: vi.fn(),
      },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await commitBatch(batchId, actorId);
    expect(tx.deliveryOrderLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deliveryId_orderId: {
            deliveryId: delivery.id,
            orderId: "55555555-5555-4555-8555-555555555555",
          },
        },
      })
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "55555555-5555-4555-8555-555555555555" } })
    );
  });
  it("creates a missing Originating Order and links it without changing the primary Delivery Order", async () => {
    const tx = transactionMock({
      importBatch: {
        findFirst: vi.fn().mockResolvedValue({
          id: batchId,
          status: "previewed",
          importType: "sapOrderBook",
          originalFileName: "order-book.xlsx",
          rows: [
            {
              id: "sap-row",
              identifier: "9100000001",
              classification: "validUpdate",
              proposedValues: {
                orderNumber: "1040000002",
                customerName: "Customer",
                grossWeightKg: "7.000",
              },
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ status: "committed", importedRows: 1, skippedRows: 0 }),
      },
      delivery: {
        findFirst: vi.fn().mockResolvedValue({
          ...delivery,
          deletedAt: null,
          order: { orderNumber: "1040000001", deletedAt: null },
        }),
      },
      order: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        upsert: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555" }),
      },
    });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));

    await commitBatch(batchId, actorId);

    expect(tx.order.create).toHaveBeenCalled();
    expect(tx.deliveryOrderLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deliveryId_orderId: { deliveryId: delivery.id, orderId: "55555555-5555-4555-8555-555555555555" } },
      })
    );
  });
  it("uses an explicit interactive transaction window for multi-row SAP imports", async () => {
    const tx = transactionMock();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
    await commitBatch(batchId, actorId);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 60_000,
    });
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
