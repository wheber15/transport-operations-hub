import { describe, expect, it } from "vitest";

import {
  assertReportRunTransition,
  canonicalJson,
  canTransitionReportRun,
  formatDailyOrdersReference,
} from "./report-run";

describe("report run domain", () => {
  it("allows only the approved lifecycle transitions", () => {
    expect(canTransitionReportRun("PENDING", "GENERATING")).toBe(true);
    expect(canTransitionReportRun("PENDING", "FAILED")).toBe(true);
    expect(canTransitionReportRun("GENERATING", "COMPLETED")).toBe(true);
    expect(canTransitionReportRun("COMPLETED", "GENERATING")).toBe(false);
    expect(() => assertReportRunTransition("FAILED", "COMPLETED")).toThrow(
      "Invalid report lifecycle transition"
    );
  });

  it("formats date-scoped canonical references", () => {
    expect(formatDailyOrdersReference("2026-07-23", 1)).toBe("AXR-ORD-20260723-001");
    expect(formatDailyOrdersReference("2026-07-23", 12)).toBe("AXR-ORD-20260723-012");
  });

  it("serializes object keys deterministically for checksums", () => {
    expect(canonicalJson({ b: [null, "x"], a: { z: 2, y: 1 } })).toBe(
      '{"a":{"y":1,"z":2},"b":[null,"x"]}'
    );
  });
});
