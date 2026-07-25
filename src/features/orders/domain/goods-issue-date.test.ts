import { describe, expect, it } from "vitest";

import { resolveGoodsIssueDateScope } from "./goods-issue-date";

describe("Goods Issue Date scopes", () => {
  it("resolves Today and Yesterday across a year boundary", () => {
    const reference = new Date("2026-01-01T12:00:00.000Z");
    expect(resolveGoodsIssueDateScope("today", reference)).toEqual({
      from: "2026-01-01",
      to: "2026-01-01",
    });
    expect(resolveGoodsIssueDateScope("yesterday", reference)).toEqual({
      from: "2025-12-31",
      to: "2025-12-31",
    });
  });

  it("resolves Tomorrow across month, year, and daylight-saving boundaries", () => {
    expect(resolveGoodsIssueDateScope("tomorrow", new Date("2026-01-31T12:00:00.000Z"))).toEqual({
      from: "2026-02-01",
      to: "2026-02-01",
    });
    expect(resolveGoodsIssueDateScope("tomorrow", new Date("2026-12-31T12:00:00.000Z"))).toEqual({
      from: "2027-01-01",
      to: "2027-01-01",
    });
    expect(resolveGoodsIssueDateScope("tomorrow", new Date("2026-03-29T23:30:00.000Z"))).toEqual({
      from: "2026-03-31",
      to: "2026-03-31",
    });
  });

  it("uses an inclusive Monday through Sunday week", () => {
    expect(resolveGoodsIssueDateScope("thisWeek", new Date("2026-07-21T12:00:00.000Z"))).toEqual({
      from: "2026-07-20",
      to: "2026-07-26",
    });
  });

  it("preserves an explicit custom calendar-date range", () => {
    expect(
      resolveGoodsIssueDateScope("custom", new Date(), { from: "2026-07-21", to: "2026-07-23" })
    ).toEqual({ from: "2026-07-21", to: "2026-07-23" });
  });
});
