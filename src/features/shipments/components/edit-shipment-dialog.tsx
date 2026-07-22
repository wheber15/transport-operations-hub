"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ShipmentForm = {
  shipmentNumber: string;
  dispatchDate: string;
  carrierId: string;
  notes: string;
};

export function EditShipmentDialog({
  carriers,
  shipment,
}: {
  carriers: Array<{
    id: string;
    name: string;
    carrierNumber: string;
    collectionTime: string | null;
    dailyTrailerLimit: number | null;
  }>;
  shipment: ShipmentForm & { id: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ShipmentForm>(shipment);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/shipments/${shipment.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok)
        throw new Error(payload?.error?.message ?? "Shipment could not be updated.");

      toast.success("Shipment updated.");
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Shipment could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        Edit Shipment
      </Button>
      {open ? (
        <div
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="border-border bg-background w-full max-w-lg rounded-xl border shadow-xl">
            <header className="border-border border-b px-5 py-4">
              <h2 className="font-semibold">Edit Shipment</h2>
            </header>
            <div className="grid gap-4 p-5">
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <label className="grid gap-1 text-sm">
                Shipment Number
                <input
                  className="border-input h-9 rounded-md border px-2"
                  value={form.shipmentNumber}
                  onChange={(event) => setForm({ ...form, shipmentNumber: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Dispatch Date
                <input
                  className="border-input h-9 rounded-md border px-2"
                  type="date"
                  value={form.dispatchDate}
                  onChange={(event) => setForm({ ...form, dispatchDate: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Carrier
                <select
                  className="border-input h-9 rounded-md border px-2"
                  value={form.carrierId}
                  onChange={(event) => setForm({ ...form, carrierId: event.target.value })}
                >
                  <option value="">Select carrier</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name} — {carrier.carrierNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Notes
                <textarea
                  className="border-input min-h-20 rounded-md border p-2"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>
            </div>
            <footer className="border-border flex justify-end gap-2 border-t px-5 py-4">
              <Button
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={pending} onClick={save} type="button">
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
