import { describe, expect, it, vi } from "vitest";

const repositoryMock = vi.hoisted(() => ({ listOrdersLeftForBusinessDate: vi.fn() }));
vi.mock("@/features/orders/infrastructure/orders-left-repository", () => repositoryMock);

import { getOrdersLeftForToday, ordersLeftFilename } from "./orders-left-service";

describe("Orders left for today service", () => {
  it("uses the Ireland business date and central pallet rule", async () => {
    repositoryMock.listOrdersLeftForBusinessDate.mockResolvedValue([
      { customerName: "Woodies", deliveryNumber: "0000000001", weightKg: "1.000" },
      { customerName: "Woodies", deliveryNumber: "0000000002", weightKg: "750.000" },
      { customerName: "Woodies", deliveryNumber: "0000000003", weightKg: "751.000" },
      { customerName: "Woodies", deliveryNumber: "0000000004", weightKg: "2403.000" },
    ]);
    await expect(
      getOrdersLeftForToday(new Date("2026-07-22T12:00:00.000Z"))
    ).resolves.toMatchObject([
      { calculatedPallets: 1 },
      { calculatedPallets: 1 },
      { calculatedPallets: 2 },
      { calculatedPallets: 4 },
    ]);
    expect(repositoryMock.listOrdersLeftForBusinessDate).toHaveBeenCalledWith("2026-07-22");
  });

  it("uses the agreed filename", () => {
    expect(ordersLeftFilename(new Date("2026-07-22T12:00:00.000Z"))).toBe(
      "Orders left for 22.07.26.xlsx"
    );
  });
});
