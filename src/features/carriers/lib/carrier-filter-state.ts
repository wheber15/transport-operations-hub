export const carrierFilterStates = ["active", "inactive", "all"] as const;

export type CarrierFilterState = (typeof carrierFilterStates)[number];

type CarrierFilterParams = {
  q?: string;
  query?: string;
  status?: string;
  state?: string;
};

export function normalizeCarrierFilterState(
  value: string | undefined,
  canManage: boolean
): CarrierFilterState {
  const state: CarrierFilterState = carrierFilterStates.includes(value as CarrierFilterState)
    ? (value as CarrierFilterState)
    : "active";

  return canManage ? state : "active";
}

export function readCarrierFilterParams(
  params: CarrierFilterParams,
  canManage: boolean
): { query?: string; state: CarrierFilterState } {
  const query = (params.q ?? params.query)?.trim();

  return {
    query: query || undefined,
    state: normalizeCarrierFilterState(params.status ?? params.state, canManage),
  };
}

export function updateCarrierFilterSearchParams(
  current: URLSearchParams,
  updates: Partial<{ query: string; state: CarrierFilterState }>
): URLSearchParams {
  const next = new URLSearchParams(current);

  if (updates.query !== undefined) {
    const query = updates.query.trim();
    next.delete("query");
    if (query) next.set("q", query);
    else next.delete("q");
  }

  if (updates.state !== undefined) {
    next.delete("state");
    if (updates.state === "active") next.delete("status");
    else next.set("status", updates.state);
  }

  return next;
}
