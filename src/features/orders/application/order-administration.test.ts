import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  getOrderById: vi.fn(),
  getOrderByOrderNumber: vi.fn(),
  getOrdersSummary: vi.fn(),
  listOrders: vi.fn(),
  restoreOrder: vi.fn(),
  searchOrders: vi.fn(),
  softDeleteOrder: vi.fn(),
  updateActiveOrder: vi.fn(),
}));

vi.mock("@/features/orders/infrastructure/order-repository", () => repository);

import {
  OrderAdministrationForbiddenError,
  OrderNotFoundError,
  deleteOrder,
  restoreOrder,
  updateOrder,
} from "./order-service";

const administrator = { id: "11111111-1111-4111-8111-111111111111", role: "Administrator" };
const planner = { id: "22222222-2222-4222-8222-222222222222", role: "Planner" };
const orderId = "33333333-3333-4333-8333-333333333333";

describe("Order administration service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows an Administrator to update only validated operational fields", async () => {
    repository.updateActiveOrder.mockResolvedValue({ id: orderId });
    await expect(updateOrder(administrator, orderId, { routeCode: " IE1211 " })).resolves.toEqual({
      id: orderId,
    });
    expect(repository.updateActiveOrder).toHaveBeenCalledWith(
      administrator.id,
      orderId,
      expect.objectContaining({ routeCode: "IE1211" })
    );
  });

  it("rejects calculated or unsupported Order fields", async () => {
    await expect(updateOrder(administrator, orderId, { actualPalletCount: 3 })).rejects.toThrow();
  });

  it("forbids planner mutations before repository access", async () => {
    await expect(deleteOrder(planner, orderId)).rejects.toBeInstanceOf(
      OrderAdministrationForbiddenError
    );
    await expect(restoreOrder(planner, orderId)).rejects.toBeInstanceOf(
      OrderAdministrationForbiddenError
    );
    expect(repository.softDeleteOrder).not.toHaveBeenCalled();
    expect(repository.restoreOrder).not.toHaveBeenCalled();
  });

  it("soft-deletes and restores only when the repository changes an Order", async () => {
    repository.softDeleteOrder.mockResolvedValue(true);
    repository.restoreOrder.mockResolvedValue(true);
    await expect(deleteOrder(administrator, orderId)).resolves.toBeUndefined();
    await expect(restoreOrder(administrator, orderId)).resolves.toBeUndefined();
    expect(repository.softDeleteOrder).toHaveBeenCalledWith(administrator.id, orderId);
    expect(repository.restoreOrder).toHaveBeenCalledWith(administrator.id, orderId);
  });

  it("returns a typed not-found error when a record state transition cannot occur", async () => {
    repository.softDeleteOrder.mockResolvedValue(null);
    await expect(deleteOrder(administrator, orderId)).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
