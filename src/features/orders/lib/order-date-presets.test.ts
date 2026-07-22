import { describe, expect, it } from "vitest";

import { orderDatePresetOptions } from "./order-date-presets";

describe("Order date preset options", () => {
  it("renders Tomorrow between Today and Yesterday", () => {
    expect(orderDatePresetOptions).toEqual([
      ["today", "Today"],
      ["tomorrow", "Tomorrow"],
      ["yesterday", "Yesterday"],
      ["thisWeek", "This Week"],
      ["all", "All"],
    ]);
  });
});
