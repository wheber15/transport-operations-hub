import { describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ getDashboardData: vi.fn() }));
vi.mock("@/features/dashboard/repositories/dashboard-repository", () => repository);

import { getDashboard } from "./dashboard-service";

describe("dashboard service", () => {
  it("uses the shared Orders today business-date scope", async () => {
    repository.getDashboardData.mockResolvedValue({});
    await getDashboard();
    const [{ start, end }] = repository.getDashboardData.mock.calls[0] as [
      { start: Date; end: Date },
    ];
    expect(end.getTime() - start.getTime()).toBe(86_400_000);
  });
});
