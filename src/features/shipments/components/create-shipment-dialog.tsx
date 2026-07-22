"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type FormFields = "shipmentNumber" | "dispatchDate" | "carrierId";
type FormState = Record<FormFields | "notes", string>;
type FormErrors = Partial<Record<FormFields, string>>;

const initialForm: FormState = { shipmentNumber: "", dispatchDate: "", carrierId: "", notes: "" };

export function CreateShipmentDialog({
  carriers,
}: {
  carriers: Array<{
    id: string;
    name: string;
    carrierNumber: string;
    collectionTime: string | null;
    dailyTrailerLimit: number | null;
  }>;
}) {
  const router = useRouter();
  const shipmentNumberRef = useRef<HTMLInputElement>(null);
  const dispatchDateRef = useRef<HTMLInputElement>(null);
  const carrierRef = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<FormState>(initialForm);
  const noCarriers = carriers.length === 0;

  function validate() {
    const next: FormErrors = {};
    if (!form.shipmentNumber.trim()) next.shipmentNumber = "Shipment number is required.";
    if (!form.dispatchDate) next.dispatchDate = "Dispatch date is required.";
    if (!form.carrierId) next.carrierId = "Carrier is required.";
    setErrors(next);
    const first = Object.keys(next)[0] as FormFields | undefined;
    if (first) {
      requestAnimationFrame(() =>
        ({
          shipmentNumber: shipmentNumberRef,
          dispatchDate: dispatchDateRef,
          carrierId: carrierRef,
        })[first].current?.focus()
      );
    }
    return Object.keys(next).length === 0;
  }

  async function create() {
    setFormError(null);
    if (!validate() || noCarriers) return;
    setPending(true);
    try {
      const response = await fetch("/api/shipments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, shipmentNumber: form.shipmentNumber.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { id: string };
        error?: { message?: string };
      } | null;
      if (!response.ok)
        throw new Error(payload?.error?.message ?? "Shipment could not be created.");
      toast.success("Shipment created.");
      router.push(`/shipments/${payload?.data?.id}`);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Shipment could not be created.");
    } finally {
      setPending(false);
    }
  }

  function fieldProps(field: FormFields) {
    return {
      "aria-describedby": errors[field] ? `${field}-error` : undefined,
      "aria-invalid": Boolean(errors[field]),
    };
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        Create Shipment
      </Button>
      {open ? (
        <div
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="border-border bg-background w-full max-w-lg rounded-xl border shadow-xl">
            <header className="border-border border-b px-5 py-4">
              <h2 className="font-semibold">Create Shipment</h2>
            </header>
            <div className="grid gap-4 p-5">
              {formError ? (
                <p className="text-destructive text-sm" role="alert">
                  {formError}
                </p>
              ) : null}
              {noCarriers ? (
                <p className="border-border bg-muted/40 rounded-md border p-3 text-sm">
                  <strong>No active Carriers are available.</strong>
                  <br />A Carrier must be created first.
                </p>
              ) : null}
              <label className="grid gap-1 text-sm">
                Shipment Number
                <input
                  {...fieldProps("shipmentNumber")}
                  ref={shipmentNumberRef}
                  className="border-input h-9 rounded-md border px-2"
                  value={form.shipmentNumber}
                  onChange={(event) => setForm({ ...form, shipmentNumber: event.target.value })}
                />
                {errors.shipmentNumber ? (
                  <span className="text-destructive text-xs" id="shipmentNumber-error">
                    {errors.shipmentNumber}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-1 text-sm">
                Dispatch Date
                <input
                  {...fieldProps("dispatchDate")}
                  ref={dispatchDateRef}
                  className="border-input h-9 rounded-md border px-2"
                  type="date"
                  value={form.dispatchDate}
                  onChange={(event) => setForm({ ...form, dispatchDate: event.target.value })}
                />
                {errors.dispatchDate ? (
                  <span className="text-destructive text-xs" id="dispatchDate-error">
                    {errors.dispatchDate}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-1 text-sm">
                Carrier
                <select
                  {...fieldProps("carrierId")}
                  ref={carrierRef}
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
                {errors.carrierId ? (
                  <span className="text-destructive text-xs" id="carrierId-error">
                    {errors.carrierId}
                  </span>
                ) : null}
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
              <Button disabled={pending || noCarriers} onClick={create} type="button">
                {pending ? "Creating…" : "Create Shipment"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
