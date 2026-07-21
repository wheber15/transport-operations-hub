"use client";

import { Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatSapWeight } from "@/features/data-management/domain/preview";
import {
  calculatePalletWeightSummary,
  estimatePalletCount,
  isValidPalletWeight,
} from "@/features/orders/domain/pallets";

type PersistedPallet = {
  id?: string;
  sequenceNumber: number;
  actualWeightKg: string;
  note: string | null;
};

type DraftPallet = PersistedPallet & { key: string };

type Workspace = {
  deliveryNumber: string;
  orderNumber: string;
  customerName: string;
  sapGrossWeightKg: string | null;
  updatedAt: string;
  pallets: PersistedPallet[];
  summary: {
    palletCount: number;
    actualPalletWeightKg: string | null;
    varianceKg: string | null;
    status: "awaitingActual" | "captured";
  };
};

type PalletApiError = Error & { fieldErrors?: Record<string, string> };

function createDraftPallet(pallet?: PersistedPallet, sequenceNumber = 1): DraftPallet {
  return {
    id: pallet?.id,
    sequenceNumber: pallet?.sequenceNumber ?? sequenceNumber,
    actualWeightKg: pallet?.actualWeightKg ?? "",
    note: pallet?.note ?? null,
    key: pallet?.id ?? crypto.randomUUID(),
  };
}

function toDraft(pallets: PersistedPallet[]) {
  return pallets.length > 0
    ? pallets.map((pallet) => createDraftPallet(pallet))
    : [createDraftPallet()];
}

function serialiseDraft(pallets: DraftPallet[]) {
  return pallets.map(({ id, sequenceNumber, actualWeightKg, note }) => ({
    id: id ?? null,
    sequenceNumber,
    actualWeightKg,
    note,
  }));
}

function buildWeightErrors(pallets: DraftPallet[]) {
  return Object.fromEntries(
    pallets.flatMap((pallet) =>
      isValidPalletWeight(pallet.actualWeightKg.trim())
        ? []
        : [[pallet.key, "Enter a weight above 0 and no more than 1,000 kg."]]
    )
  );
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const errorBody =
      typeof body === "object" && body !== null && "error" in body
        ? (body.error as { message?: string; fieldErrors?: Record<string, string> })
        : null;
    const error = new Error(
      errorBody?.message ?? "The server returned an unexpected response. Please try again."
    ) as PalletApiError;
    error.fieldErrors = errorBody?.fieldErrors;
    throw error;
  }

  return body as { data: Workspace };
}

export function ManagePalletsDialog({
  deliveryId,
  deliveryNumber,
}: {
  deliveryId: string;
  deliveryNumber: string;
}) {
  const router = useRouter();
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [draft, setDraft] = useState<DraftPallet[]>([]);
  const [initialDraft, setInitialDraft] = useState("[]");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightErrors, setWeightErrors] = useState<Record<string, string>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const enteredWeights = useMemo(
    () => draft.map((pallet) => pallet.actualWeightKg.trim()).filter(isValidPalletWeight),
    [draft]
  );
  const draftSummary = useMemo(
    () => calculatePalletWeightSummary(enteredWeights, workspace?.sapGrossWeightKg ?? null),
    [enteredWeights, workspace?.sapGrossWeightKg]
  );
  const isDirty =
    serialiseDraft(draft).some((pallet, index) => {
      const initial = JSON.parse(initialDraft) as ReturnType<typeof serialiseDraft>;
      return JSON.stringify(pallet) !== JSON.stringify(initial[index]);
    }) || draft.length !== (JSON.parse(initialDraft) as unknown[]).length;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirmDiscard) {
        event.preventDefault();
        requestClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function focusWeight(key: string) {
    requestAnimationFrame(() => inputRefs.current.get(key)?.focus());
  }

  async function openWorkspace() {
    setOpen(true);
    setError(null);
    setWeightErrors({});
    setConfirmDiscard(false);
    setWorkspace(null);

    try {
      const result = await readResponse(
        await fetch(`/api/deliveries/${deliveryId}/pallets`, { cache: "no-store" })
      );
      const loadedDraft = toDraft(result.data.pallets);
      setWorkspace(result.data);
      setDraft(loadedDraft);
      setInitialDraft(JSON.stringify(serialiseDraft(loadedDraft)));
      focusWeight(
        loadedDraft.find((pallet) => !pallet.actualWeightKg.trim())?.key ?? loadedDraft[0]!.key
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Pallets are unavailable.");
    }
  }

  function close() {
    setOpen(false);
    setConfirmDiscard(false);
    setError(null);
    setWeightErrors({});
  }

  function requestClose() {
    if (pending) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    close();
  }

  function updateWeight(key: string, actualWeightKg: string) {
    setDraft((current) =>
      current.map((pallet) => (pallet.key === key ? { ...pallet, actualWeightKg } : pallet))
    );
    setWeightErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function addPallet() {
    const pallet = createDraftPallet(undefined, draft.length + 1);
    setDraft((current) => [...current, pallet]);
    focusWeight(pallet.key);
  }

  function removePallet(key: string) {
    setDraft((current) =>
      current
        .filter((pallet) => pallet.key !== key)
        .map((pallet, index) => ({ ...pallet, sequenceNumber: index + 1 }))
    );
    setWeightErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function moveToNextPallet(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = draft[index + 1];
    if (next) {
      focusWeight(next.key);
      return;
    }
    addPallet();
  }

  async function save() {
    if (!workspace || pending) return;
    const clientErrors = buildWeightErrors(draft);
    if (Object.keys(clientErrors).length > 0) {
      setWeightErrors(clientErrors);
      setError("Correct the highlighted pallet weights before saving.");
      const firstInvalid = draft.find((pallet) => clientErrors[pallet.key]);
      if (firstInvalid) focusWeight(firstInvalid.key);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await readResponse(
        await fetch(`/api/deliveries/${deliveryId}/pallets`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            updatedAt: workspace.updatedAt,
            pallets: draft.map(({ id, sequenceNumber, actualWeightKg, note }) => ({
              ...(id ? { id } : {}),
              sequenceNumber,
              actualWeightKg: actualWeightKg.trim(),
              note,
            })),
          }),
        })
      );
      setWorkspace(result.data);
      router.refresh();
      toast.success("Pallets saved successfully.");
      close();
    } catch (requestError) {
      const requestFailure = requestError as PalletApiError;
      if (requestFailure.fieldErrors) {
        const errors = Object.fromEntries(
          Object.entries(requestFailure.fieldErrors).flatMap(([path, message]) => {
            const match = /^pallets\.(\d+)\.actualWeightKg$/.exec(path);
            const pallet = match ? draft[Number(match[1])] : undefined;
            return pallet ? [[pallet.key, message]] : [];
          })
        );
        setWeightErrors(errors);
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Pallets could not be saved. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={openWorkspace} size="xs" type="button" variant="outline">
        Manage pallets
      </Button>
      {open ? (
        <div
          aria-labelledby={`pallet-dialog-${deliveryId}`}
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) requestClose();
          }}
          role="dialog"
        >
          <div className="border-border bg-background max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border shadow-xl">
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-foreground font-semibold" id={`pallet-dialog-${deliveryId}`}>
                  Manage pallets
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Sales Order {workspace?.orderNumber ?? "—"} · Delivery{" "}
                  {workspace?.deliveryNumber ?? deliveryNumber}
                </p>
              </div>
              <Button
                aria-label="Close pallet manager"
                onClick={requestClose}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
            <div className="space-y-5 px-5 py-4">
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              {!workspace && !error ? (
                <p className="text-muted-foreground text-sm">Loading pallet records…</p>
              ) : null}
              {workspace ? (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Customer</dt>
                      <dd className="font-medium">{workspace.customerName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">SAP gross weight</dt>
                      <dd className="font-medium">
                        {formatSapWeight(workspace.sapGrossWeightKg) ?? "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Estimated pallets</dt>
                      <dd className="font-medium">
                        {estimatePalletCount(workspace.sapGrossWeightKg) ?? "Not available"}
                      </dd>
                    </div>
                  </dl>
                  <dl
                    aria-live="polite"
                    className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm sm:grid-cols-4"
                  >
                    <div>
                      <dt className="text-muted-foreground">Actual pallets</dt>
                      <dd className="font-medium">{draftSummary.palletCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Actual pallet weight</dt>
                      <dd className="font-medium">
                        {formatSapWeight(draftSummary.actualPalletWeightKg) ?? "Not captured"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Weight variance</dt>
                      <dd className="font-medium">
                        {draftSummary.varianceKg
                          ? formatSapWeight(draftSummary.varianceKg)
                          : "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Capture status</dt>
                      <dd className="font-medium">
                        {draftSummary.status === "captured" ? "Captured" : "Awaiting pallet data"}
                      </dd>
                    </div>
                  </dl>
                  <div className="border-border overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left">Pallet</th>
                          <th className="px-3 py-2 text-left">Weight (kg)</th>
                          <th className="px-3 py-2">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.map((pallet, index) => {
                          const fieldError = weightErrors[pallet.key];
                          return (
                            <tr className="border-border border-t" key={pallet.key}>
                              <td className="px-3 py-2">Pallet {index + 1}</td>
                              <td className="px-3 py-2">
                                <input
                                  aria-describedby={
                                    fieldError ? `pallet-weight-error-${pallet.key}` : undefined
                                  }
                                  aria-invalid={Boolean(fieldError)}
                                  aria-label={`Pallet ${index + 1} weight in kilograms`}
                                  className="border-input bg-background aria-[invalid=true]:border-destructive h-9 w-full rounded-md border px-2"
                                  inputMode="decimal"
                                  onChange={(event) => updateWeight(pallet.key, event.target.value)}
                                  onKeyDown={(event) => moveToNextPallet(event, index)}
                                  ref={(element) => {
                                    if (element) inputRefs.current.set(pallet.key, element);
                                    else inputRefs.current.delete(pallet.key);
                                  }}
                                  value={pallet.actualWeightKg}
                                />
                                {fieldError ? (
                                  <p
                                    className="text-destructive mt-1 text-xs"
                                    id={`pallet-weight-error-${pallet.key}`}
                                  >
                                    {fieldError}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  aria-label={`Remove pallet ${index + 1}`}
                                  disabled={pending}
                                  onClick={() => removePallet(pallet.key)}
                                  size="icon-xs"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    disabled={pending}
                    onClick={addPallet}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus />
                    Add pallet
                  </Button>
                </>
              ) : null}
            </div>
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-4">
              <Button disabled={pending} onClick={requestClose} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={pending || !workspace} onClick={save} type="button">
                <Save />
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDiscard ? (
        <div
          aria-labelledby={`discard-pallet-dialog-${deliveryId}`}
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-[60] grid place-items-center p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="border-border bg-background w-full max-w-md rounded-xl border p-5 shadow-xl">
            <h2 className="font-semibold" id={`discard-pallet-dialog-${deliveryId}`}>
              Discard pallet changes?
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Your unsaved pallet weights will be lost.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                autoFocus
                onClick={() => setConfirmDiscard(false)}
                type="button"
                variant="outline"
              >
                Keep editing
              </Button>
              <Button onClick={close} type="button" variant="destructive">
                Discard changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
