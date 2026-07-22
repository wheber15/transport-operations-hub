import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  carrier: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

import { listCarriers } from "./carrier-repository";

describe("Carrier repository filtering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("combines an inactive status filter and a search query", async () => {
    prismaMock.carrier.findMany.mockResolvedValue([]);

    await listCarriers({ query: "Dachser", state: "inactive" });

    expect(prismaMock.carrier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: false,
          deletedAt: null,
          OR: expect.arrayContaining([
            { carrierNumber: { contains: "Dachser", mode: "insensitive" } },
            { name: { contains: "Dachser", mode: "insensitive" } },
            { contactName: { contains: "Dachser", mode: "insensitive" } },
            { email: { contains: "Dachser", mode: "insensitive" } },
            { phone: { contains: "Dachser", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });

  it("uses an unfiltered active state only when all is requested", async () => {
    prismaMock.carrier.findMany.mockResolvedValue([]);

    await listCarriers({ state: "all" });

    expect(prismaMock.carrier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    );
  });
});
