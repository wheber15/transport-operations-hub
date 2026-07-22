"use client";

import { Filter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  shipmentAdvancedFilterKeys,
  updateShipmentSearchParams,
} from "@/features/shipments/lib/shipment-url-state";

type CarrierOption = { id: string; name: string; carrierNumber: string; active: boolean };
type Draft = Record<(typeof shipmentAdvancedFilterKeys)[number], string>;
const emptyDraft = (): Draft => ({
  carrierId: "",
  status: "all",
  dispatchFrom: "",
  dispatchTo: "",
  deliveryNumber: "",
  orderNumber: "",
});

export function ShipmentsFilters({ carriers }: { carriers: CarrierOption[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const current = (): Draft =>
    Object.fromEntries(
      shipmentAdvancedFilterKeys.map((key) => [key, params.get(key) ?? emptyDraft()[key]])
    ) as Draft;
  const activeCount = shipmentAdvancedFilterKeys.filter((key) => {
    const value = params.get(key);
    return value && value !== "all";
  }).length;
  const navigate = (values: Draft, clear = false) => {
    const updates: Record<string, string | undefined> = { page: "1" };
    shipmentAdvancedFilterKeys.forEach((key) => {
      updates[key] = clear ? undefined : values[key] || undefined;
    });
    if (clear && params.get("datePreset") === "custom") updates.datePreset = "all";
    else if (!clear && (values.dispatchFrom || values.dispatchTo)) updates.datePreset = "custom";
    const next = updateShipmentSearchParams(new URLSearchParams(params.toString()), updates);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
    setOpen(false);
  };
  const update = (key: keyof Draft, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  return (
    <>
      <Button
        onClick={() => {
          setDraft(current());
          setOpen(true);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <Filter aria-hidden="true" />
        Filters{activeCount ? ` ${activeCount}` : ""}
      </Button>
      {open ? (
        <div
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4"
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
          role="dialog"
        >
          <div className="bg-background border-border max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Shipment filters</h2>
              <Button
                aria-label="Close Shipment filters"
                onClick={() => setOpen(false)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Carrier
                <select
                  className="border-input mt-1 h-10 w-full rounded-md border px-2"
                  onChange={(event) => update("carrierId", event.target.value)}
                  value={draft.carrierId}
                >
                  <option value="">All Carriers</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name} — {carrier.carrierNumber}
                      {carrier.active ? "" : " (Inactive)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Status
                <select
                  className="border-input mt-1 h-10 w-full rounded-md border px-2"
                  onChange={(event) => update("status", event.target.value)}
                  value={draft.status}
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              {(
                [
                  ["dispatchFrom", "Dispatch date from", "date"],
                  ["dispatchTo", "Dispatch date to", "date"],
                  ["deliveryNumber", "Delivery number", "text"],
                  ["orderNumber", "Sales Order number", "text"],
                ] as const
              ).map(([key, label, type]) => (
                <label className="text-sm" key={key}>
                  {label}
                  <input
                    className="border-input mt-1 h-10 w-full rounded-md border px-2"
                    onChange={(event) => update(key, event.target.value)}
                    type={type}
                    value={draft[key]}
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button onClick={() => navigate(emptyDraft(), true)} type="button" variant="outline">
                Clear filters
              </Button>
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button onClick={() => navigate(draft)} type="button">
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
