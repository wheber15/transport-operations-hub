import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  getOrdersSummary: vi.fn(),
  listOrders: vi.fn(),
}));

vi.mock("@/features/orders/infrastructure/order-repository", () => repository);

import { getOrdersSummary, getValidatedOrderFilters, listOrders } from "./order-service";

const tomorrowFilters = {
  datePreset: "tomorrow",
  query: "Woodies",
  shipmentState: "unassigned",
  palletState: "awaiting",
  page: 1,
  pageSize: 25,
  sortBy: "goodsIssueDate",
  sortDirection: "asc",
} as const;

describe("Order Tomorrow date preset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it("accepts Tomorrow and safely falls back from an invalid preset", () => {
    expect(getValidatedOrderFilters(tomorrowFilters).datePreset).toBe("tomorrow");
    expect(getValidatedOrderFilters({ datePreset: "invalid" }).datePreset).toBe("today");
  });

  it("uses the same Tomorrow scope for the table and summary", async () => {
    repository.listOrders.mockResolvedValue({ items: [], total: 0 });
    repository.getOrdersSummary.mockResolvedValue({
      orders: 0,
      deliveries: 0,
      assignedToShipment: 0,
      awaitingActualPalletData: 0,
    });

    await listOrders(tomorrowFilters, { role: "Planner" });
    await getOrdersSummary(tomorrowFilters, { role: "Planner" });

    const expectedScope = expect.objectContaining({
      datePreset: "tomorrow",
      goodsIssueFrom: "2026-07-23",
      goodsIssueTo: "2026-07-23",
      query: "Woodies",
      shipmentState: "unassigned",
      palletState: "awaiting",
    });
    expect(repository.listOrders).toHaveBeenCalledWith(expectedScope);
    expect(repository.getOrdersSummary).toHaveBeenCalledWith(expectedScope);
  });
});
