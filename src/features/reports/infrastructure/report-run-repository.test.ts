import { describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  activity: { create: vi.fn() },
  reportRun: { create: vi.fn(), findFirst: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (operation: (tx: typeof transaction) => unknown) =>
    operation(transaction)
  ),
}));

vi.mock("@/server/db/prisma", () => ({ prisma }));

import { createPendingDailyOrdersRun } from "./report-run-repository";

const reportRun = {
  id: "8eeed912-85a9-4ddd-99de-037b22e23b93",
  reportType: "DAILY_ORDERS",
  reference: "AXR-ORD-20260723-001",
  referenceSequence: 1,
  referenceBusinessDate: new Date("2026-07-23T00:00:00.000Z"),
  scopeStartDate: new Date("2026-07-23T00:00:00.000Z"),
  scopeEndDate: new Date("2026-07-23T00:00:00.000Z"),
  status: "PENDING",
  rowCount: 1,
  exceptionCount: 0,
  requestedByDisplayName: "Planner",
  requestedByRole: "Planner",
  generationStartedAt: null,
  generationCompletedAt: null,
  failureCode: null,
  failureMessage: null,
  createdAt: new Date("2026-07-23T08:00:00.000Z"),
  artifacts: [],
};

function input() {
  return {
    referenceBusinessDate: "2026-07-23",
    scopeStartDate: "2026-07-23",
    scopeEndDate: "2026-07-23",
    filters: { reportType: "DAILY_ORDERS" },
    kpiSnapshot: {},
    exceptionSummary: {},
    rowCount: 1,
    exceptionCount: 0,
    snapshotSchemaVersion: "1.0",
    datasetVersion: "1.0",
    datasetChecksum: "a".repeat(64),
    templateVersion: "1.0",
    requestedBy: {
      id: "b3bc1b8b-38f3-46d4-964d-49b223cb8af6",
      displayName: "Planner",
      role: "Planner",
    },
  };
}

describe("transactional Daily Orders reference allocation", () => {
  it("allocates a date-scoped reference inside a serializable transaction", async () => {
    transaction.reportRun.findFirst.mockResolvedValue(null);
    transaction.$queryRaw.mockResolvedValue([{ lastSequence: 1 }]);
    transaction.reportRun.create.mockResolvedValue(reportRun);
    transaction.activity.create.mockResolvedValue({});

    const result = await createPendingDailyOrdersRun(input());

    expect(result).toMatchObject({
      created: { reference: "AXR-ORD-20260723-001" },
      duplicate: null,
    });
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.reportRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ referenceSequence: 1 }) })
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.any(Object));
  });

  it("returns an existing equivalent run without allocating a second reference", async () => {
    vi.clearAllMocks();
    transaction.reportRun.findFirst.mockResolvedValue(reportRun);

    const result = await createPendingDailyOrdersRun(input());

    expect(result).toMatchObject({
      duplicate: { reference: "AXR-ORD-20260723-001" },
      created: null,
    });
    expect(transaction.$queryRaw).not.toHaveBeenCalled();
    expect(transaction.reportRun.create).not.toHaveBeenCalled();
  });
});
