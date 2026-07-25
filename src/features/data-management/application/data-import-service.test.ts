import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  createImportBatch: vi.fn(),
  createSapOrderBookBatch: vi.fn(),
  getImportBatch: vi.fn(),
  getActiveDeliveryRecords: vi.fn(),
  getOrderRecords: vi.fn(),
  savePreview: vi.fn(),
  saveSapOrderBookDatePreview: vi.fn(),
  getImportBatchPreviewContext: vi.fn(),
  getImportHeaderRow: vi.fn(),
  getPreviewRows: vi.fn(),
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
import {
  commitImport,
  getImportPreviewRows,
  previewImport,
  uploadImport,
} from "./data-import-service";

describe("data import service authorization and preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.getOrderRecords.mockResolvedValue([]);
  });
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
  it("stages a selected SAP Order Book instead of returning the temporary unavailable error", async () => {
    vi.mocked(parseImportFile).mockResolvedValue({
      sheets: [
        {
          name: "Sheet1",
          rows: [
            [
              "Sales Document",
              "Originating Document",
              "Open gross weight",
              "Weight Unit",
              "Name 1",
            ],
            ["9100000001", "1040000001", "0", "KG", ""],
            ["", "1040000001", "7,000 KG", "KG", "Customer"],
          ],
        },
      ],
    });
    repository.getActiveDeliveryRecords.mockResolvedValue([]);
    repository.createSapOrderBookBatch.mockResolvedValue({ id: "batch", totalRows: 1 });
    const result = await uploadImport(
      { id: "user", role: "Planner" },
      "sapOrderBook",
      new File(["x"], "order-book.xlsx")
    );
    expect(result).toMatchObject({ id: "batch" });
    expect(repository.createSapOrderBookBatch).toHaveBeenCalledWith(
      expect.objectContaining({ rows: [expect.objectContaining({ identifier: "9100000001" })] })
    );
    expect(repository.createImportBatch).not.toHaveBeenCalled();
  });
  it("stages a valid SAP Order Book row as ready to create when its Delivery and Order are new", async () => {
    vi.mocked(parseImportFile).mockResolvedValue({
      sheets: [
        {
          name: "Sheet1",
          rows: [
            [
              "Sales Document",
              "Originating Document",
              "Open gross weight",
              "Weight Unit",
              "Name 1",
            ],
            ["9100000001", "1040000001", "0", "KG", ""],
            ["", "1040000001", "7,000 KG", "KG", "Customer"],
          ],
        },
      ],
    });
    repository.getActiveDeliveryRecords.mockResolvedValue([]);
    repository.createSapOrderBookBatch.mockResolvedValue({ id: "batch", totalRows: 1 });
    await uploadImport(
      { id: "user", role: "Planner" },
      "sapOrderBook",
      new File(["x"], "order-book.xlsx")
    );
    expect(repository.createSapOrderBookBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            classification: "readyToCreate",
            message: "Ready to create a Customer, Order, Delivery, and association.",
          }),
        ],
      })
    );
  });
  it("reports an unchanged existing SAP row without treating it as a creation request", async () => {
    vi.mocked(parseImportFile).mockResolvedValue({
      sheets: [
        {
          name: "Sheet1",
          rows: [
            [
              "Sales Document",
              "Originating Document",
              "Open gross weight",
              "Weight Unit",
              "Name 1",
            ],
            ["9100000001", "1040000001", "0", "KG", ""],
            ["", "1040000001", "7,000 KG", "KG", "Customer"],
          ],
        },
      ],
    });
    repository.getActiveDeliveryRecords.mockResolvedValue([
      {
        deliveryNumber: "9100000001",
        shipmentId: null,
        deletedAt: null,
        order: {
          orderNumber: "1040000001",
          goodsIssueDate: null,
          shipToNumber: null,
          routeCode: null,
          shippingPoint: null,
          grossWeightKg: { toFixed: () => "7.000" },
          deletedAt: null,
          customer: { name: "Customer" },
        },
      },
    ]);
    repository.getOrderRecords.mockResolvedValue([
      {
        orderNumber: "1040000001",
        goodsIssueDate: null,
        shipToNumber: null,
        routeCode: null,
        shippingPoint: null,
        grossWeightKg: { toFixed: () => "7.000" },
        deletedAt: null,
        customer: { name: "Customer" },
      },
    ]);
    repository.createSapOrderBookBatch.mockResolvedValue({ id: "batch", totalRows: 1 });
    await uploadImport(
      { id: "user", role: "Planner" },
      "sapOrderBook",
      new File(["x"], "order-book.xlsx")
    );
    expect(repository.createSapOrderBookBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ classification: "unchanged" })],
      })
    );
  });
  it("rejects an SAP Order Book selected as Delivery Reference before staging records", async () => {
    vi.mocked(parseImportFile).mockResolvedValue({
      sheets: [
        {
          name: "Sheet1",
          rows: [
            ["Sales Document", "Originating Document", "Name 1"],
            ["80000001", "70000001", "Customer"],
          ],
        },
      ],
    });
    await expect(
      uploadImport(
        { id: "user", role: "Planner" },
        "deliveryReference",
        new File(["x"], "order-book.xlsx")
      )
    ).rejects.toThrow("SAP_ORDER_BOOK_REQUIRED");
    expect(repository.createImportBatch).not.toHaveBeenCalled();
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
    const savedRows = vi.mocked(repository.savePreview).mock.calls[0][0].rows;
    expect(savedRows).not.toContainEqual(expect.objectContaining({ id: "header" }));
    expect(savedRows.map((row: { id: string }) => row.id)).toEqual(["one", "two"]);
  });
  it("returns only mapped planner-facing preview values with bounded pagination", async () => {
    repository.getImportBatchPreviewContext.mockResolvedValue({
      id: "batch",
      importType: "deliveryReference",
      selectedSheetName: "Sheet1",
      selectedHeaderRow: 1,
      mapping: { deliveryNumber: "Delivery", grossWeightKg: "Gross Weight" },
    });
    repository.getImportHeaderRow.mockResolvedValue({
      mappedValues: { values: ["Delivery", "Gross Weight", "Private"] },
    });
    repository.getPreviewRows.mockResolvedValue({
      total: 1,
      classifications: [{ classification: "deliveryNotFound", _count: { _all: 1 } }],
      rows: [
        {
          sourceRowNumber: 2,
          identifier: "000TEST1001",
          classification: "deliveryNotFound",
          message: "No matching delivery was found.",
          mappedValues: { values: ["000TEST1001", "7,000 KG", "not exposed"] },
          currentValues: null,
          proposedValues: { deliveryNumber: "000TEST1001", grossWeightKg: "7,000 KG" },
        },
      ],
    });
    const result = await getImportPreviewRows({ id: "user", role: "Planner" }, "batch", {
      view: "preview",
      page: 1,
      pageSize: 20,
    });
    expect(result.rows[0]).toMatchObject({
      sourceRowNumber: 2,
      classificationLabel: "Delivery not found",
      displayValues: { deliveryNumber: "000TEST1001", grossWeightKg: "7.000 kg" },
    });
    expect(JSON.stringify(result)).not.toContain("not exposed");
    await expect(
      getImportPreviewRows({ id: "user", role: "Planner" }, "batch", {
        view: "preview",
        pageSize: 101,
      })
    ).rejects.toThrow();
  });
  it("excludes the selected header from raw rows and marks formula cells unsupported", async () => {
    repository.getImportBatchPreviewContext.mockResolvedValue({
      id: "batch",
      importType: "deliveryReference",
      selectedSheetName: "Sheet1",
      selectedHeaderRow: 2,
      mapping: null,
    });
    repository.getImportHeaderRow.mockResolvedValue({ mappedValues: { values: ["Delivery"] } });
    repository.getPreviewRows.mockResolvedValue({
      total: 1,
      classifications: [],
      rows: [
        {
          sourceRowNumber: 3,
          mappedValues: { values: ["__FORMULA__"] },
          identifier: null,
          classification: "unsupportedField",
          message: "",
          currentValues: null,
          proposedValues: null,
        },
      ],
    });
    const result = await getImportPreviewRows({ id: "user", role: "Planner" }, "batch", {
      view: "raw",
      pageSize: 20,
    });
    expect(repository.getPreviewRows).toHaveBeenCalledWith(
      expect.objectContaining({ headerRow: 2 })
    );
    expect(result.rows).toEqual([{ sourceRowNumber: 3, values: ["Formula (unsupported)"] }]);
  });
  it("requires an authorized actor for commit", async () => {
    await expect(commitImport({ id: "user", role: "Viewer" }, "batch")).rejects.toThrow();
  });
});
