import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/prisma", () => ({ prisma: {} }));

import { buildDailyOrdersReportWhere } from "./daily-orders-report-repository";

const baseFilters = {
  datePreset: "today" as const,
  from: "2026-07-23",
  to: "2026-07-23",
  page: 1,
  pageSize: 25,
  shipmentState: "all" as const,
  palletState: "all" as const,
  recordState: "active" as const,
};

describe("Daily Orders report query scope", () => {
  it("adds one shared delivery scope when delivery filters are active", () => {
    const where = buildDailyOrdersReportWhere({
      ...baseFilters,
      route: "IE1211",
      shipmentState: "unassigned",
      palletState: "awaiting",
    });

    expect(where).toMatchObject({
      deletedAt: null,
      routeCode: { equals: "IE1211", mode: "insensitive" },
      deliveries: {
        some: {
          deletedAt: null,
          shipmentId: null,
          pallets: { none: { deletedAt: null } },
        },
      },
    });
  });

  it("does not require a delivery match when the report has no delivery-level filters", () => {
    const where = buildDailyOrdersReportWhere(baseFilters);

    expect(where.deliveries).toBeUndefined();
  });
});
