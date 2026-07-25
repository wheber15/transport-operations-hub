import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  CarrierExportDuplicateError: class CarrierExportDuplicateError extends Error {},
  CarrierExportStateError: class CarrierExportStateError extends Error {},
  completeExport: vi.fn(),
  createPendingExport: vi.fn(),
  failExport: vi.fn(),
  findActiveCarrier: vi.fn(),
  getBaselineRun: vi.fn(),
  getCompletedArtifact: vi.fn(),
  getCumulativeSentDeliveryNumbers: vi.fn(),
  listActiveCarriers: vi.fn(),
  listHistory: vi.fn(),
  listSourceDeliveries: vi.fn(),
  markSent: vi.fn(),
  recordArtifactDownload: vi.fn(),
}));
const renderer = vi.hoisted(() => ({ renderDachserXlsx: vi.fn() }));

vi.mock("@/features/carrier-exports/infrastructure/carrier-export-repository", () => repository);
vi.mock("@/features/carrier-exports/infrastructure/dachser-xlsx-renderer", () => renderer);
vi.mock("@/features/orders/lib/order-export-field-gate", () => ({
  areOrderExportFieldsAvailable: () => true,
}));

import {
  CarrierExportForbiddenError,
  generateCarrierExport,
  getCarrierExportPreview,
} from "./carrier-export-service";

const planner = { id: "planner-1", displayName: "Planner", role: "Planner" };
const carrier = {
  id: "11111111-1111-4111-8111-111111111111",
  carrierNumber: "401210",
  name: "Dachser",
};

function source(
  deliveryId: string,
  deliveryNumber: string,
  overrides: Record<string, unknown> = {}
): {
  deliveryId: string;
  linkedOrderCount: number;
  linkedOrderNumbers: string[];
  blockers: Array<{ code: string; message: string }>;
  row: Record<string, unknown>;
} {
  return {
    deliveryId,
    linkedOrderCount: 1,
    linkedOrderNumbers: [],
    blockers: [],
    row: {
      carrierId: null,
      city: "Dublin",
      deliveryNumber,
      goodsIssueDate: "2026-07-22",
      palletUnit: null,
      postalCode: "D01",
      salesOrderNumber: " SO-001 ",
      region: "D",
      shipToName2: "Warehouse",
      shipToParty: "000123",
      shipmentNumber: null,
      soldToName1: "Woodies",
      street: "Main Street",
      totalWeightKg: "750.001",
      ...overrides,
    },
  };
}

function sourceResult(...sources: ReturnType<typeof source>[]) {
  return {
    excluded: { inactiveDeliveries: 0, inactiveLinkedOrders: 0, mixedLinkedOrderStates: 0 },
    excludedRecords: [],
    sources,
  };
}

describe("Carrier Export service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.findActiveCarrier.mockResolvedValue(carrier);
    repository.getBaselineRun.mockResolvedValue(null);
    repository.getCumulativeSentDeliveryNumbers.mockResolvedValue(new Set());
    repository.listSourceDeliveries.mockResolvedValue(
      sourceResult(source("delivery-1", "9108325191"))
    );
  });

  it("builds an Initial preview with the export-only planned pallet calculation", async () => {
    const preview = await getCarrierExportPreview(planner, {
      carrierId: carrier.id,
      goodsIssueDate: "2026-07-22",
      stage: "INITIAL",
    });

    expect(preview.exportRows).toHaveLength(1);
    expect(preview.exportRows[0].row.palletUnit).toBe(2);
    expect(preview.exportRows[0].row.salesOrderNumber).toBe(" SO-001 ");
    expect(preview.blockers).toEqual([]);
    expect(repository.listSourceDeliveries).toHaveBeenCalledWith("2026-07-22");
  });

  it("limits Addition exports to deliveries that have never been sent", async () => {
    repository.listSourceDeliveries.mockResolvedValue(
      sourceResult(source("delivery-1", "9108325191"), source("delivery-2", "9108325192"))
    );
    repository.getCumulativeSentDeliveryNumbers.mockResolvedValue(new Set(["9108325191"]));
    repository.getBaselineRun.mockResolvedValue({
      id: "baseline-1",
      reference: "AXC-DAC-INI-20260722-000",
      rows: [],
    });

    const preview = await getCarrierExportPreview(planner, {
      carrierId: carrier.id,
      goodsIssueDate: "2026-07-22",
      stage: "ADDITION",
    });

    expect(preview.exportRows.map((item) => item.row.deliveryNumber)).toEqual(["9108325192"]);
    expect(preview.counts.added).toBe(1);
  });

  it("marks changed rows against an Update baseline without changing operational data", async () => {
    repository.getBaselineRun.mockResolvedValue({
      id: "baseline-1",
      reference: "AXC-DAC-INI-20260722-000",
      rows: [{ deliveryNumber: "9108325191", rowChecksum: "different" }],
    });

    const preview = await getCarrierExportPreview(planner, {
      carrierId: carrier.id,
      goodsIssueDate: "2026-07-22",
      stage: "UPDATE",
    });

    expect(preview.exportRows[0].changeClassification).toBe("CHANGED");
    expect(preview.counts.changed).toBe(1);
  });

  it("keeps active blocked Deliveries visible as diagnostics without including them in export totals", async () => {
    repository.listSourceDeliveries.mockResolvedValue(
      sourceResult(source("delivery-valid", "9108325191"), {
        ...source("delivery-blocked", "9108325192"),
        blockers: [{ code: "CONFLICTING_DESTINATION", message: "Destination data conflicts." }],
      })
    );

    const preview = await getCarrierExportPreview(planner, {
      carrierId: carrier.id,
      goodsIssueDate: "2026-07-22",
      stage: "INITIAL",
    });

    expect(preview.exportRows.map((item) => item.row.deliveryNumber)).toEqual(["9108325191"]);
    expect(preview.diagnostics.blockedActiveDeliveries).toBe(1);
    expect(preview.diagnostics.validationIssueCount).toBe(1);
    expect(preview.totalWeightKg).toBe("750.001");
  });

  it("groups multiple validation issues under one blocked Delivery while preserving eligible totals", async () => {
    repository.listSourceDeliveries.mockResolvedValue(
      sourceResult(source("delivery-valid", "9108325191"), {
        ...source("delivery-blocked", "9108325192", {
          shipToParty: null,
          soldToName1: null,
          street: null,
          city: null,
          postalCode: null,
          region: null,
          shipmentNumber: null,
        }),
        blockers: [{ code: "CONFLICTING_DESTINATION", message: "Destination data conflicts." }],
      })
    );

    const preview = await getCarrierExportPreview(planner, {
      carrierId: carrier.id,
      goodsIssueDate: "2026-07-22",
      stage: "INITIAL",
    });

    expect(preview.exportRows.map((item) => item.row.deliveryNumber)).toEqual(["9108325191"]);
    expect(preview.diagnostics.blockedActiveDeliveries).toBe(1);
    expect(preview.diagnostics.validationIssueCount).toBe(3);
    expect(preview.diagnostics.blockedDeliveries).toEqual([
      expect.objectContaining({
        deliveryNumber: "9108325192",
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "CONFLICTING_DESTINATION" }),
          expect.objectContaining({ code: "MISSING_SHIP_TO" }),
          expect.objectContaining({ code: "MISSING_SOLD_TO_NAME" }),
        ]),
      }),
    ]);
  });

  it("treats a third linked Order on an existing Delivery as an Update change, not an Addition", async () => {
    repository.listSourceDeliveries.mockResolvedValue(
      sourceResult({
        ...source("delivery-1", "9108325191", { totalWeightKg: "1750.001" }),
        linkedOrderCount: 3,
        linkedOrderNumbers: ["SO-001", "SO-002", "SO-003"],
      })
    );
    repository.getBaselineRun.mockResolvedValue({
      id: "baseline-1",
      reference: "AXC-DAC-INI-20260722-000",
      rows: [{ deliveryNumber: "9108325191", rowChecksum: "previous-delivery-state" }],
    });

    const preview = await getCarrierExportPreview(planner, {
      carrierId: carrier.id,
      goodsIssueDate: "2026-07-22",
      stage: "UPDATE",
    });

    expect(preview.exportRows).toHaveLength(1);
    expect(preview.exportRows[0]).toMatchObject({
      changeClassification: "CHANGED",
      linkedOrderCount: 3,
      linkedOrderNumbers: ["SO-001", "SO-002", "SO-003"],
    });
    expect(preview.exportRows[0].row.palletUnit).toBe(3);
  });

  it("persists an immutable pending snapshot before rendering and completing an Initial file", async () => {
    repository.createPendingExport.mockResolvedValue({ id: "export-1", sequence: 0 });
    renderer.renderDachserXlsx.mockResolvedValue(Buffer.from("xlsx"));
    repository.completeExport.mockResolvedValue({
      id: "export-1",
      reference: "AXC-DAC-INI-20260722-000",
    });
    const storage = { open: vi.fn(), remove: vi.fn(), write: vi.fn().mockResolvedValue(undefined) };

    await expect(
      generateCarrierExport(
        planner,
        { carrierId: carrier.id, goodsIssueDate: "2026-07-22", stage: "INITIAL" },
        storage
      )
    ).resolves.toMatchObject({ filename: "CSV file for 22.07.2026.xlsx" });

    expect(repository.createPendingExport).toHaveBeenCalledBefore(renderer.renderDachserXlsx);
    expect(storage.write).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: expect.stringMatching(/^carrier-exports\/export-1\//) })
    );
    expect(repository.completeExport).toHaveBeenCalledWith(
      expect.objectContaining({ exportRunId: "export-1" })
    );
  });

  it("rejects unsupported roles before querying export data", async () => {
    await expect(
      getCarrierExportPreview(
        { ...planner, role: "Viewer" },
        {
          carrierId: carrier.id,
          goodsIssueDate: "2026-07-22",
          stage: "INITIAL",
        }
      )
    ).rejects.toBeInstanceOf(CarrierExportForbiddenError);
    expect(repository.findActiveCarrier).not.toHaveBeenCalled();
  });
});
