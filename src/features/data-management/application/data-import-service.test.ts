import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  createImportBatch: vi.fn(),
  getImportBatch: vi.fn(),
  getActiveDeliveryRecords: vi.fn(),
  savePreview: vi.fn(),
  commitBatch: vi.fn(),
  listImportBatches: vi.fn(),
}));
vi.mock("@/features/data-management/infrastructure/data-import-repository", () => repository);
vi.mock("@/features/data-management/lib/parsing", () => ({
  parseImportFile: vi.fn(),
  parseBusinessDate: vi.fn(() => "2024-01-01"),
  parseSapWeight: vi.fn(() => "7.000"),
}));
import { parseImportFile } from "@/features/data-management/lib/parsing";
import { commitImport, previewImport, uploadImport } from "./data-import-service";

describe("data import service authorization and preview", () => {
  beforeEach(() => vi.clearAllMocks());
  it("allows active planners and rejects unauthorized roles at the service boundary", async () => {
    vi.mocked(parseImportFile).mockResolvedValue({
      sheets: [{ name: "Sheet1", rows: [["Delivery"]] }],
    });
    repository.createImportBatch.mockResolvedValue({ id: "batch" });
    await uploadImport(
      { id: "user", role: "Planner" },
      "deliveryReference",
      new File(["x"], "file.csv")
    );
    await expect(
      uploadImport({ id: "user", role: "Viewer" }, "deliveryReference", new File(["x"], "file.csv"))
    ).rejects.toThrow();
  });
  it("does not let a client provide classifications and flags duplicate delivery rows", async () => {
    repository.getImportBatch.mockResolvedValue({
      id: "batch",
      status: "configured",
      importType: "deliveryReference",
      selectedSheetName: "Sheet1",
      selectedHeaderRow: 1,
      mapping: { deliveryNumber: "Delivery" },
      rows: [
        {
          id: "header",
          sheetName: "Sheet1",
          sourceRowNumber: 1,
          mappedValues: { values: ["Delivery"] },
        },
        {
          id: "one",
          sheetName: "Sheet1",
          sourceRowNumber: 2,
          mappedValues: { values: ["000123"] },
        },
        {
          id: "two",
          sheetName: "Sheet1",
          sourceRowNumber: 3,
          mappedValues: { values: ["000123"] },
        },
      ],
    });
    repository.getActiveDeliveryRecords.mockResolvedValue([]);
    repository.savePreview.mockResolvedValue({});
    await previewImport({ id: "user", role: "Administrator" }, "batch");
    expect(repository.savePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.arrayContaining([expect.objectContaining({ classification: "duplicateRow" })]),
      })
    );
  });
  it("requires an authorized actor for commit", async () => {
    await expect(commitImport({ id: "user", role: "Viewer" }, "batch")).rejects.toThrow();
  });
});
