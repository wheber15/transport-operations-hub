import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  getDeliveryPalletWorkspace: vi.fn(),
  replaceDeliveryPallets: vi.fn(),
}));

vi.mock("@/features/orders/infrastructure/pallet-repository", () => repository);

import {
  PalletDeliveryNotFoundError,
  PalletForbiddenError,
  getPalletWorkspace,
  savePalletSet,
} from "./pallet-service";

const administrator = { id: "11111111-1111-4111-8111-111111111111", role: "Administrator" };
const planner = { id: "22222222-2222-4222-8222-222222222222", role: "Planner" };
const deliveryId = "33333333-3333-4333-8333-333333333333";

describe("pallet service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows the existing pallet-management roles to save valid pallet sets", async () => {
    repository.replaceDeliveryPallets.mockResolvedValue({ deliveryId });
    await expect(
      savePalletSet(planner, deliveryId, {
        pallets: [{ sequenceNumber: 1, actualWeightKg: "420" }],
      })
    ).resolves.toEqual({ deliveryId });
    expect(repository.replaceDeliveryPallets).toHaveBeenCalledWith(
      planner,
      deliveryId,
      expect.objectContaining({ pallets: [{ sequenceNumber: 1, actualWeightKg: "420" }] })
    );
  });

  it("rejects a caller without an existing pallet-management role", async () => {
    await expect(
      savePalletSet({ ...administrator, role: "Viewer" }, deliveryId, {
        pallets: [{ sequenceNumber: 1, actualWeightKg: "420" }],
      })
    ).rejects.toBeInstanceOf(PalletForbiddenError);
    expect(repository.replaceDeliveryPallets).not.toHaveBeenCalled();
  });

  it("returns a typed not-found error for an inactive or unavailable Delivery", async () => {
    repository.getDeliveryPalletWorkspace.mockResolvedValue(null);
    await expect(getPalletWorkspace(administrator, deliveryId)).rejects.toBeInstanceOf(
      PalletDeliveryNotFoundError
    );
  });
});
