import { describe, expect, it } from "vitest";

import { orderPresetHref } from "./order-url-state";

describe("Order workspace URL state", () => {
  it("preserves compatible filters and resets pagination for Tomorrow", () => {
    expect(
      orderPresetHref("tomorrow", {
        page: 4,
        pageSize: 50,
        query: "Woodies",
        sortBy: "goodsIssueDate",
        sortDirection: "desc",
        datePreset: "today",
        customer: "Woodies",
        route: "IE1211",
        shipTo: "85287",
        shipmentState: "unassigned",
        palletState: "awaiting",
        recordState: "deleted",
      })
    ).toBe(
      "/orders?page=1&pageSize=50&sortBy=goodsIssueDate&sortDirection=desc&datePreset=tomorrow&query=Woodies&customer=Woodies&route=IE1211&shipTo=85287&shipmentState=unassigned&palletState=awaiting&recordState=deleted"
    );
  });
});
