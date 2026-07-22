import { describe, expect, it, vi } from "vitest";

const sessionMock = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const serviceMock = vi.hoisted(() => ({
  getOrdersLeftForToday: vi.fn(),
  ordersLeftFilename: vi.fn(),
}));
const workbookMock = vi.hoisted(() => ({ createOrdersLeftWorkbook: vi.fn() }));

vi.mock("@/features/auth/application/session", () => sessionMock);
vi.mock("@/features/orders/application/orders-left-service", () => serviceMock);
vi.mock("@/features/orders/lib/orders-left-workbook", () => workbookMock);

import { GET } from "./route";

describe("Orders left workbook route", () => {
  it("rejects unauthenticated requests", async () => {
    sessionMock.getCurrentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns a planner-readable no-data response instead of an empty workbook", async () => {
    sessionMock.getCurrentUser.mockResolvedValue({ id: "user-1" });
    serviceMock.getOrdersLeftForToday.mockResolvedValue([]);
    const response = await GET();
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      message: "No orders are left for today.",
    });
  });

  it("returns a no-store XLSX attachment", async () => {
    sessionMock.getCurrentUser.mockResolvedValue({ id: "user-1" });
    serviceMock.getOrdersLeftForToday.mockResolvedValue([{ deliveryNumber: "1" }]);
    serviceMock.ordersLeftFilename.mockReturnValue("Orders left for 22.07.26.xlsx");
    workbookMock.createOrdersLeftWorkbook.mockResolvedValue(Buffer.from("xlsx"));
    const response = await GET();
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("content-disposition")).toContain("Orders left for 22.07.26.xlsx");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
