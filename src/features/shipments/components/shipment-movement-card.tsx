"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Clock3, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getShipmentMovementState,
  toIrelandDateTimeLocal,
  type ShipmentMovementState,
} from "@/features/shipments/domain/movement";
import { formatIrelandDateTime } from "@/lib/business-date";

type MovementDraft = {
  driverInAt: string;
  trailerLoadedAt: string;
  driverOutAt: string;
};

type MovementField = keyof MovementDraft;

const labels: Record<MovementField, string> = {
  driverInAt: "Driver In",
  trailerLoadedAt: "Trailer Loaded",
  driverOutAt: "Driver Out",
};

const statePresentation: Record<ShipmentMovementState, { badge: string; label: string }> = {
  "awaiting-driver": {
    label: "Awaiting driver",
    badge: "bg-muted text-muted-foreground",
  },
  "on-site": { label: "Driver on site", badge: "bg-primary/10 text-primary" },
  loaded: { label: "Loaded / trailer closed", badge: "bg-primary/10 text-primary" },
  departed: { label: "Departed", badge: "bg-muted text-foreground" },
};

function toDraft(values: Record<MovementField, string | null>): MovementDraft {
  return {
    driverInAt: values.driverInAt ?? "",
    trailerLoadedAt: values.trailerLoadedAt ?? "",
    driverOutAt: values.driverOutAt ?? "",
  };
}

export function ShipmentMovementCard({
  canManage,
  shipmentId,
  values,
}: {
  canManage: boolean;
  shipmentId: string;
  values: Record<MovementField, string | null>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<MovementDraft>(() => toDraft(values));
  const [errors, setErrors] = useState<Partial<Record<MovementField, string>>>({});
  const inputRefs = {
    driverInAt: useRef<HTMLInputElement>(null),
    trailerLoadedAt: useRef<HTMLInputElement>(null),
    driverOutAt: useRef<HTMLInputElement>(null),
  };
  const state = getShipmentMovementState({
    driverInAt: values.driverInAt ? new Date(values.driverInAt) : null,
    trailerLoadedAt: values.trailerLoadedAt ? new Date(values.trailerLoadedAt) : null,
    driverOutAt: values.driverOutAt ? new Date(values.driverOutAt) : null,
  });

  function openEditor(field?: MovementField) {
    const nextDraft = toDraft(values);
    if (field && !nextDraft[field]) nextDraft[field] = toIrelandDateTimeLocal(new Date());
    setDraft(nextDraft);
    setErrors({});
    setOpen(true);
  }

  async function save() {
    setPending(true);
    setErrors({});
    try {
      const response = await fetch(`/api/shipments/${shipmentId}/movement`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          driverInAt: draft.driverInAt || null,
          trailerLoadedAt: draft.trailerLoadedAt || null,
          driverOutAt: draft.driverOutAt || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { fieldErrors?: Partial<Record<MovementField, string[]>>; message?: string };
      } | null;
      if (!response.ok) {
        const fieldErrors = Object.fromEntries(
          Object.entries(payload?.error?.fieldErrors ?? {}).flatMap(([field, messages]) =>
            messages?.[0] ? [[field, messages[0]]] : []
          )
        ) as Partial<Record<MovementField, string>>;
        setErrors(fieldErrors);
        const firstInvalid = Object.keys(fieldErrors)[0] as MovementField | undefined;
        if (firstInvalid) inputRefs[firstInvalid].current?.focus();
        throw new Error(payload?.error?.message ?? "Movement times could not be saved.");
      }
      setOpen(false);
      toast.success("Movement times saved.");
      router.refresh();
    } catch (error) {
      if (Object.keys(errors).length === 0) {
        toast.error(error instanceof Error ? error.message : "Movement times could not be saved.");
      }
    } finally {
      setPending(false);
    }
  }

  const nextAction: MovementField | null = !values.driverInAt
    ? "driverInAt"
    : !values.trailerLoadedAt
      ? "trailerLoadedAt"
      : !values.driverOutAt
        ? "driverOutAt"
        : null;

  return (
    <section className="border-border/80 bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="border-border/80 flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
            <Clock3 aria-hidden="true" className="text-muted-foreground size-4" />
            Operational movement
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">Ireland local time</p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${statePresentation[state].badge}`}
        >
          {statePresentation[state].label}
        </span>
      </div>
      <dl className="divide-border/80 divide-y">
        {(Object.keys(labels) as MovementField[]).map((field) => (
          <div
            className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            key={field}
          >
            <div>
              <dt className="text-muted-foreground text-sm">{labels[field]}</dt>
              <dd className="text-foreground mt-1 text-sm font-medium">
                {values[field] ? formatIrelandDateTime(new Date(values[field])) : "Not recorded"}
              </dd>
            </div>
            {canManage && nextAction === field ? (
              <Button onClick={() => openEditor(field)} size="sm" type="button" variant="outline">
                {field === "driverInAt"
                  ? "Record Driver In"
                  : field === "trailerLoadedAt"
                    ? "Mark Trailer Loaded"
                    : "Record Driver Out"}
              </Button>
            ) : null}
          </div>
        ))}
      </dl>
      {canManage ? (
        <div className="border-border/80 flex justify-end border-t px-5 py-3">
          <Button onClick={() => openEditor()} size="sm" type="button" variant="ghost">
            <Pencil aria-hidden="true" />
            Edit movement times
          </Button>
        </div>
      ) : null}
      <Dialog.Root onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)} open={open}>
        <Dialog.Portal>
          <Dialog.Backdrop className="bg-background/80 fixed inset-0 z-50 min-h-dvh backdrop-blur-sm" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid min-h-dvh place-items-center p-4">
            <Dialog.Popup className="border-border bg-background max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border shadow-xl">
              <header className="border-border border-b px-5 py-4">
                <Dialog.Title className="text-foreground font-semibold">
                  Edit movement times
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground mt-1 text-sm">
                  Use Ireland local time. Trailer Loaded closes an open Shipment.
                </Dialog.Description>
              </header>
              <div className="grid gap-4 p-5">
                {(Object.keys(labels) as MovementField[]).map((field) => (
                  <label className="grid gap-1 text-sm" key={field}>
                    {labels[field]}
                    <input
                      aria-describedby={errors[field] ? `${field}-error` : undefined}
                      aria-invalid={Boolean(errors[field])}
                      className="border-input bg-background aria-invalid:border-destructive h-9 rounded-md border px-2"
                      onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                      ref={inputRefs[field]}
                      type="datetime-local"
                      value={draft[field]}
                    />
                    {errors[field] ? (
                      <span className="text-destructive text-sm" id={`${field}-error`} role="alert">
                        {errors[field]}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
              <footer className="border-border flex justify-end gap-2 border-t px-5 py-4">
                <Dialog.Close
                  render={<Button disabled={pending} type="button" variant="outline" />}
                >
                  Cancel
                </Dialog.Close>
                <Button disabled={pending} onClick={save} type="button">
                  {pending ? "Saving…" : "Save movement times"}
                </Button>
              </footer>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
