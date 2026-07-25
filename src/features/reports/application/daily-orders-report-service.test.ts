import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ getDailyOrdersReportData: vi.fn() }));
const reportRuns = vi.hoisted(() => ({
  beginDailyOrdersXlsxGeneration: vi.fn(),
  completeDailyOrdersXlsxArtifact: vi.fn(),
  createPendingDailyOrdersRun: vi.fn(),
  failDailyOrdersXlsxArtifact: vi.fn(),
  deleteReportRun: vi.fn(),
  getReportForDeletion: vi.fn(),
  getCompletedReportArtifact: vi.fn(),
  listReportHistory: vi.fn(),
  markReportRunFailed: vi.fn(),
  persistDailyOrdersSnapshot: vi.fn(),
}));
const renderer = vi.hoisted(() => ({ renderDailyOrdersXlsx: vi.fn() }));
vi.mock("@/features/reports/infrastructure/daily-orders-report-repository", () => repository);
vi.mock("@/features/reports/infrastructure/report-run-repository", () => reportRuns);
vi.mock("@/features/reports/infrastructure/daily-orders-xlsx-renderer", () => renderer);

import {
  createDailyOrdersReportSnapshot,
  deleteReport,
  generateDailyOrdersXlsx,
  getDailyOrdersReport,
  getValidatedDailyOrdersReportFilters,
  listReportHistory,
  ReportRecordStateForbiddenError,
  ReportsAccessForbiddenError,
  ReportXlsxFailedError,
  ReportDeleteForbiddenError,
  ReportDeleteUnavailableError,
  toCanonicalDailyOrdersReportFilters,
} from "./daily-orders-report-service";

describe("Daily Orders report service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T23:30:00.000Z"));
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it("uses the Dublin Tomorrow scope and safe invalid preset fallback", () => {
    expect(getValidatedDailyOrdersReportFilters({ datePreset: "tomorrow" })).toMatchObject({
      datePreset: "tomorrow",
      from: "2026-03-31",
      to: "2026-03-31",
    });
    expect(getValidatedDailyOrdersReportFilters({ datePreset: "invalid" }).datePreset).toBe(
      "today"
    );
  });

  it("authorizes deleted record access on the server", async () => {
    await expect(
      getDailyOrdersReport({ recordState: "deleted" }, { role: "Planner" })
    ).rejects.toBeInstanceOf(ReportRecordStateForbiddenError);
  });

  it("permits only approved report roles", async () => {
    await expect(getDailyOrdersReport({}, { role: "Viewer" })).rejects.toBeInstanceOf(
      ReportsAccessForbiddenError
    );
  });

  it("persists a canonical filter contract without pagination", () => {
    const filters = getValidatedDailyOrdersReportFilters({
      datePreset: "today",
      page: 4,
      pageSize: 100,
      route: "IE1211",
    });
    expect(toCanonicalDailyOrdersReportFilters(filters)).toEqual({
      reportType: "DAILY_ORDERS",
      datePreset: "today",
      scopeStartDate: "2026-03-30",
      scopeEndDate: "2026-03-30",
      query: null,
      customer: null,
      route: "IE1211",
      shipTo: null,
      carrier: null,
      shipmentState: "all",
      palletState: "all",
      recordState: "active",
    });
  });

  it("creates an immutable snapshot after the pending run is allocated", async () => {
    repository.getDailyOrdersReportData.mockResolvedValue({
      normalizedRows: [],
      kpis: {
        totalOrders: 0,
        totalDeliveries: 0,
        totalSapWeightKg: null,
        totalActualWeightKg: null,
        comparableSapWeightKg: null,
        comparableActualWeightKg: null,
        weightVarianceKg: null,
        weightVariancePercentage: null,
        estimatedPallets: 0,
        actualPallets: 0,
        palletVariance: null,
        deliveriesWithActualWeight: 0,
        deliveriesMissingActualWeight: 0,
        actualWeightCoveragePercentage: null,
        assignedToShipment: 0,
        awaitingShipment: 0,
        awaitingPalletData: 0,
        overdue: 0,
        shipmentsCreated: 0,
        remainingTrailerRequirement: 0,
      },
      exceptions: [],
    });
    reportRuns.createPendingDailyOrdersRun.mockResolvedValue({
      duplicate: null,
      created: { id: "report-run-1" },
    });
    reportRuns.persistDailyOrdersSnapshot.mockResolvedValue({
      id: "report-run-1",
      status: "COMPLETED",
    });

    await expect(
      createDailyOrdersReportSnapshot(
        { datePreset: "today", page: 5, pageSize: 100 },
        { id: "planner-1", displayName: "Planner", role: "Planner" }
      )
    ).resolves.toMatchObject({ duplicate: false, run: { status: "COMPLETED" } });
    expect(reportRuns.persistDailyOrdersSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ reportRunId: "report-run-1", rows: [] })
    );
  });

  it("marks an allocated run failed when snapshot persistence fails", async () => {
    reportRuns.persistDailyOrdersSnapshot.mockRejectedValue(new Error("database detail"));
    reportRuns.markReportRunFailed.mockResolvedValue({ id: "report-run-1", status: "FAILED" });

    await expect(
      createDailyOrdersReportSnapshot(
        { datePreset: "today" },
        { id: "planner-1", displayName: "Planner", role: "Planner" }
      )
    ).rejects.toMatchObject({ message: "The report snapshot could not be completed." });
    expect(reportRuns.markReportRunFailed).toHaveBeenCalledWith("report-run-1", "planner-1", {
      code: "REPORT_SNAPSHOT_FAILED",
      message: "The report snapshot could not be completed safely.",
    });
  });

  it("limits failure details in history to Administrators", async () => {
    reportRuns.listReportHistory.mockResolvedValue([
      {
        id: "run-1",
        status: "FAILED",
        failureCode: "REPORT_SNAPSHOT_FAILED",
        failureMessage: "Safe failure",
      },
    ]);

    await expect(listReportHistory({ role: "Planner" })).resolves.toEqual([
      { id: "run-1", status: "FAILED", failureCode: null, failureMessage: null },
    ]);
    await expect(listReportHistory({ role: "Administrator" })).resolves.toEqual([
      {
        id: "run-1",
        status: "FAILED",
        failureCode: "REPORT_SNAPSHOT_FAILED",
        failureMessage: "Safe failure",
      },
    ]);
  });
});

describe("Report deletion", () => {
  const administrator = { id: "admin-1", displayName: "Admin", role: "Administrator" };
  const planner = { id: "planner-1", displayName: "Planner", role: "Planner" };
  const storage = { write: vi.fn(), open: vi.fn(), remove: vi.fn() };
  const report = {
    id: "report-1",
    status: "COMPLETED",
    artifacts: [
      { storageKey: "reports/report-1/xlsx/file.xlsx" },
      { storageKey: "reports/report-1/pdf/file.pdf" },
    ],
  };
  beforeEach(() => {
    vi.clearAllMocks();
    reportRuns.getReportForDeletion.mockResolvedValue(report);
    storage.remove.mockResolvedValue(undefined);
    reportRuns.deleteReportRun.mockResolvedValue(undefined);
  });
  it("allows an Administrator to remove report rows, artifacts, and private XLSX/PDF files", async () => {
    await expect(deleteReport(administrator, "report-1", storage)).resolves.toBe(true);
    expect(storage.remove).toHaveBeenCalledTimes(2);
    expect(reportRuns.deleteReportRun).toHaveBeenCalledWith("report-1", "admin-1");
  });
  it.each([planner, { ...planner, role: "Viewer" }])(
    "rejects non-Administrators",
    async (actor) => {
      await expect(deleteReport(actor, "report-1", storage)).rejects.toBeInstanceOf(
        ReportDeleteForbiddenError
      );
      expect(reportRuns.getReportForDeletion).not.toHaveBeenCalled();
    }
  );
  it("returns false for a missing report and prevents replay", async () => {
    reportRuns.getReportForDeletion.mockResolvedValue(null);
    await expect(deleteReport(administrator, "missing", storage)).resolves.toBe(false);
  });
  it("does not delete a generating report", async () => {
    reportRuns.getReportForDeletion.mockResolvedValue({ ...report, status: "GENERATING" });
    await expect(deleteReport(administrator, "report-1", storage)).rejects.toBeInstanceOf(
      ReportDeleteUnavailableError
    );
  });
  it("leaves database history intact when private storage cleanup fails", async () => {
    storage.remove.mockRejectedValue(new Error("private path"));
    await expect(deleteReport(administrator, "report-1", storage)).rejects.toBeInstanceOf(
      ReportXlsxFailedError
    );
    expect(reportRuns.deleteReportRun).not.toHaveBeenCalled();
  });
});

const xlsxRun = {
  id: "report-run-1",
  reportType: "DAILY_ORDERS",
  status: "COMPLETED",
  reference: "AXR-ORD-20260723-001",
  referenceBusinessDate: new Date("2026-07-23T00:00:00.000Z"),
  scopeStartDate: new Date("2026-07-23T00:00:00.000Z"),
  scopeEndDate: new Date("2026-07-23T00:00:00.000Z"),
  requestedByDisplayName: "Planner",
  requestedByRole: "Planner",
  createdAt: new Date("2026-07-23T00:00:00.000Z"),
  generationCompletedAt: new Date("2026-07-23T00:01:00.000Z"),
  snapshotSchemaVersion: "1.0",
  datasetVersion: "1.0",
  datasetChecksum: "a".repeat(64),
  templateVersion: "1.0",
  filters: { datePreset: "today" },
  kpiSnapshot: {
    totalOrders: 0,
    totalDeliveries: 0,
    totalSapWeightKg: null,
    totalActualWeightKg: null,
    comparableSapWeightKg: null,
    comparableActualWeightKg: null,
    weightVarianceKg: null,
    weightVariancePercentage: null,
    estimatedPallets: 0,
    actualPallets: 0,
    palletVariance: null,
    deliveriesWithActualWeight: 0,
    deliveriesMissingActualWeight: 0,
    actualWeightCoveragePercentage: null,
    assignedToShipment: 0,
    awaitingShipment: 0,
    awaitingPalletData: 0,
    overdue: 0,
    shipmentsCreated: 0,
    remainingTrailerRequirement: 0,
  },
  exceptionSummary: { total: 0, bySeverity: {}, byCategory: {}, items: [] },
  rowCount: 0,
  snapshotRows: [],
};

describe("Daily Orders XLSX generation", () => {
  const actor = { id: "planner-1", displayName: "Planner", role: "Planner" };
  const storage = { write: vi.fn(), open: vi.fn(), remove: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    reportRuns.beginDailyOrdersXlsxGeneration.mockResolvedValue({
      run: xlsxRun,
      artifactId: "artifact-1",
    });
    renderer.renderDailyOrdersXlsx.mockResolvedValue(Buffer.from("xlsx"));
    storage.write.mockResolvedValue(undefined);
    reportRuns.completeDailyOrdersXlsxArtifact.mockResolvedValue(undefined);
  });
  it.each(["Planner", "Administrator"])("allows approved %s roles", async (role) => {
    await expect(
      generateDailyOrdersXlsx({ ...actor, role }, "report-run-1", storage)
    ).resolves.toMatchObject({
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(renderer.renderDailyOrdersXlsx).toHaveBeenCalledWith(
      expect.objectContaining({ rows: [] })
    );
  });
  it("rejects unsupported roles before repository access", async () => {
    await expect(
      generateDailyOrdersXlsx({ ...actor, role: "Viewer" }, "report-run-1", storage)
    ).rejects.toBeInstanceOf(ReportsAccessForbiddenError);
    expect(reportRuns.beginDailyOrdersXlsxGeneration).not.toHaveBeenCalled();
  });
  it("marks storage failures as sanitized artifact failures", async () => {
    storage.write.mockRejectedValue(new Error("C:/private/storage sensitive stack"));
    await expect(generateDailyOrdersXlsx(actor, "report-run-1", storage)).rejects.toBeInstanceOf(
      ReportXlsxFailedError
    );
    expect(reportRuns.failDailyOrdersXlsxArtifact).toHaveBeenCalledWith("artifact-1", "planner-1", {
      code: "REPORT_XLSX_GENERATION_FAILED",
      message: "The Excel report could not be generated safely.",
    });
  });
  it("rejects unsupported snapshot schema without rendering", async () => {
    reportRuns.beginDailyOrdersXlsxGeneration.mockResolvedValue({
      run: { ...xlsxRun, snapshotSchemaVersion: "invalid" },
      artifactId: "artifact-1",
    });
    await expect(generateDailyOrdersXlsx(actor, "report-run-1", storage)).rejects.toBeInstanceOf(
      ReportXlsxFailedError
    );
    expect(renderer.renderDailyOrdersXlsx).not.toHaveBeenCalled();
  });
});
