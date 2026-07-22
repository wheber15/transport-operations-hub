import type { GoodsIssueDatePreset } from "@/features/orders/domain/goods-issue-date";

export const orderDatePresetOptions = [
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["yesterday", "Yesterday"],
  ["thisWeek", "This Week"],
  ["all", "All"],
] as const satisfies ReadonlyArray<readonly [Exclude<GoodsIssueDatePreset, "custom">, string]>;
