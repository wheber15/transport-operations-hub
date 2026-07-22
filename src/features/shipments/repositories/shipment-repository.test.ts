import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  shipment: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  activity: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

import {
  buildShipmentsWhere,
  closeShipment,
  createShipment,
  getById,
  getSummary,
  list,
  unassignDeliveryAtomically,
  updateMovementTimesAtomically,
  updateOpenShipment,
} from "./shipment-repository";

const actorId = "11111111-1111-4111-8111-111111111111";
const shipmentId = "22222222-2222-4222-8222-222222222222";
const carrierId = "33333333-3333-4333-8333-333333333333";

const shipmentWithNoMovementTimes = {
  id: shipmentId,
  carrierId,
  shipmentNumber: "AXON-001",
  dispatchDate: null,
  deliveryDate: null,
  status: "OPEN" as const,
  driverInAt: null,
  trailerLoadedAt: null,
  driverOutAt: null,
  carrier: { name: "Dachser", carrierNumber: "401210", deletedAt: null },
  _count: { deliveries: 0 },
  deliveries: [],
};

const defaultListFilters = {
  page: 1,
  pageSize: 25,
  datePreset: "all" as const,
  status: "all" as const,
  sortBy: "shipmentNumber" as const,
  sortDirection: "asc" as const,
};

describe("shipment repository lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a Shipment with auditable ownership", async () => {
    prismaMock.shipment.create.mockResolvedValue({ id: shipmentId, status: "OPEN" });
    await createShipment(actorId, {
      shipmentNumber: "AXON-001",
      carrierId,
      dispatchDate: "2026-07-21",
    });
    expect(prismaMock.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shipmentNumber: "AXON-001",
          carrierId,
          createdById: actorId,
          updatedById: actorId,
        }),
      })
    );
  });

  it("returns a typed duplicate result", async () => {
    prismaMock.shipment.create.mockRejectedValue({ code: "P2002" });
    await expect(
      createShipment(actorId, { shipmentNumber: "AXON-001", carrierId, dispatchDate: "2026-07-21" })
    ).resolves.toBe("duplicate");
  });

  it("edits active Shipments regardless of lifecycle status", async () => {
    prismaMock.shipment.updateMany.mockResolvedValue({ count: 1 });
    await expect(updateOpenShipment(actorId, shipmentId, { notes: "Updated" })).resolves.toBe(
      "updated"
    );
    expect(prismaMock.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
    prismaMock.shipment.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateOpenShipment(actorId, shipmentId, { notes: "Updated" })).resolves.toBe(
      "not-open"
    );
  });

  it("releases an assigned Delivery from a Closed Shipment", async () => {
    const transaction = {
      shipment: { findFirst: vi.fn().mockResolvedValue({ shipmentNumber: "AXON-001" }) },
      delivery: {
        findFirst: vi.fn().mockResolvedValue({ deliveryNumber: "19411588" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      activity: { create: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) => callback(transaction)
    );
    await expect(
      unassignDeliveryAtomically({ actorId, shipmentId, deliveryId: "delivery-id" })
    ).resolves.toBe("unassigned");
    expect(transaction.shipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: shipmentId, deletedAt: null } })
    );
    expect(transaction.delivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shipmentId: null, updatedById: actorId }),
      })
    );
  });

  it("requires confirmation before closing an empty Shipment", async () => {
    const transaction = {
      shipment: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ shipmentNumber: "AXON-001", _count: { deliveries: 0 } }),
        update: vi.fn(),
      },
      activity: { create: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) => callback(transaction)
    );
    await expect(closeShipment(actorId, shipmentId, false)).resolves.toBe("empty");
    await expect(closeShipment(actorId, shipmentId, true)).resolves.toBe("closed");
    expect(transaction.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CLOSED",
          closedById: actorId,
          closedAt: expect.any(Date),
        }),
      })
    );
  });

  it("records Trailer Loaded atomically, closes the Shipment, and audits the transition", async () => {
    const transaction = {
      shipment: {
        findFirst: vi.fn().mockResolvedValue({
          shipmentNumber: "AXON-001",
          status: "OPEN",
          driverInAt: new Date("2026-07-22T08:00:00.000Z"),
          trailerLoadedAt: null,
          driverOutAt: null,
        }),
        update: vi.fn(),
      },
      activity: { create: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) => callback(transaction)
    );

    await expect(
      updateMovementTimesAtomically({
        actorId,
        shipmentId,
        times: {
          driverInAt: new Date("2026-07-22T08:00:00.000Z"),
          trailerLoadedAt: new Date("2026-07-22T09:00:00.000Z"),
          driverOutAt: null,
        },
      })
    ).resolves.toBe("updated");

    expect(transaction.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CLOSED", closedById: actorId }),
      })
    );
    expect(transaction.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "trailer_loaded" }) })
    );
  });

  it("combines Carrier, date, Delivery, Order, and status filters", () => {
    const where = buildShipmentsWhere({
      page: 1,
      pageSize: 25,
      datePreset: "custom",
      dispatchFrom: "2026-07-20",
      dispatchTo: "2026-07-22",
      carrierId,
      status: "open",
      deliveryNumber: "19411588",
      orderNumber: "50001234",
      sortBy: "shipmentNumber",
      sortDirection: "asc",
    });
    expect(where).toMatchObject({
      deletedAt: null,
      dispatchDate: {
        gte: new Date("2026-07-20T00:00:00.000Z"),
        lte: new Date("2026-07-22T00:00:00.000Z"),
      },
      AND: expect.arrayContaining([{ carrierId }, { status: "OPEN" }]),
    });
  });

  it("combines a Tomorrow dispatch scope with Carrier and search filters", () => {
    const where = buildShipmentsWhere({
      ...defaultListFilters,
      query: "Dachser",
      carrierId,
      datePreset: "tomorrow",
      dispatchFrom: "2026-07-24",
      dispatchTo: "2026-07-24",
    });

    expect(where).toMatchObject({
      dispatchDate: {
        gte: new Date("2026-07-24T00:00:00.000Z"),
        lte: new Date("2026-07-24T00:00:00.000Z"),
      },
      AND: expect.arrayContaining([{ carrierId }]),
    });
    expect(where.OR).toEqual(
      expect.arrayContaining([{ carrier: { name: { contains: "Dachser", mode: "insensitive" } } }])
    );
  });

  it("loads pre-migration Shipments with null movement timestamps as awaiting driver", async () => {
    prismaMock.$transaction.mockResolvedValue([[shipmentWithNoMovementTimes], 1]);

    await expect(list(defaultListFilters)).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: shipmentId,
          movementState: "awaiting-driver",
        }),
      ],
      total: 1,
    });

    expect(prismaMock.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          driverInAt: true,
          trailerLoadedAt: true,
          driverOutAt: true,
        }),
      })
    );
  });

  it("calculates summary metrics when movement timestamps are null", async () => {
    prismaMock.shipment.findMany.mockResolvedValue([shipmentWithNoMovementTimes]);
    prismaMock.shipment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await expect(getSummary(defaultListFilters)).resolves.toEqual({
      shipments: 1,
      plannedPallets: 0,
      actualPallets: 0,
      actualWeight: null,
      openShipments: 1,
    });
  });

  it("returns Shipment detail with empty activity and null movement timestamps", async () => {
    prismaMock.shipment.findFirst.mockResolvedValue({
      ...shipmentWithNoMovementTimes,
      notes: null,
      createdAt: new Date("2026-07-22T08:00:00.000Z"),
      updatedAt: new Date("2026-07-22T08:00:00.000Z"),
      createdBy: null,
      updatedBy: null,
      closedAt: null,
      closedBy: null,
    });
    prismaMock.activity.findMany.mockResolvedValue([]);

    await expect(getById(shipmentId)).resolves.toEqual(
      expect.objectContaining({
        movementState: "awaiting-driver",
        driverInAt: null,
        trailerLoadedAt: null,
        driverOutAt: null,
        activities: [],
      })
    );
  });
});
