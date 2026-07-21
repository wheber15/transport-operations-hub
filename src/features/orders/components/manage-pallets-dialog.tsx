"use client";

import { Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatSapWeight } from "@/features/data-management/domain/preview";
import { calculatePalletWeightSummary, estimatePalletCount } from "@/features/orders/domain/pallets";

type Pallet = { id?: string; sequenceNumber: number; actualWeightKg: string; note: string | null };
type Workspace = {
  deliveryNumber: string;
  orderNumber: string;
  customerName: string;
  sapGrossWeightKg: string | null;
  updatedAt: string;
  pallets: Pallet[];
  summary: { palletCount: number; actualPalletWeightKg: string | null; varianceKg: string | null; status: string };
};

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body
      ? (body.error as { message?: string }).message
      : "The server returned an unexpected response.";
    throw new Error(message ?? "The pallet request could not be completed.");
  }
  return body as { data: Workspace };
}

export function ManagePalletsDialog({ deliveryId, deliveryNumber }: { deliveryId: string; deliveryNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [draft, setDraft] = useState<Pallet[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const draftSummary = useMemo(
    () => calculatePalletWeightSummary(draft.map((pallet) => pallet.actualWeightKg), workspace?.sapGrossWeightKg ?? null),
    [draft, workspace?.sapGrossWeightKg]
  );

  async function openWorkspace() {
    if (process.env.NODE_ENV === "development") console.info("pallet dialog opened", { deliveryNumber });
    setOpen(true);
    setError(null);
    setSuccess(null);
    setWorkspace(null);
    try {
      const result = await readResponse(await fetch(`/api/deliveries/${deliveryId}/pallets`, { cache: "no-store" }));
      setWorkspace(result.data);
      setDraft(result.data.pallets);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Pallets are unavailable.");
    }
  }

  function updateWeight(index: number, actualWeightKg: string) {
    setDraft((current) => current.map((pallet, currentIndex) => currentIndex === index ? { ...pallet, actualWeightKg } : pallet));
  }

  function addPallet() {
    if (process.env.NODE_ENV === "development") console.info("pallet add clicked", { deliveryNumber });
    setDraft((current) => [...current, { sequenceNumber: current.length + 1, actualWeightKg: "", note: null }]);
  }

  function removePallet(index: number) {
    if (!window.confirm("Remove this pallet from the delivery?")) return;
    setDraft((current) => current.filter((_, currentIndex) => currentIndex !== index).map((pallet, sequenceNumber) => ({ ...pallet, sequenceNumber: sequenceNumber + 1 })));
  }

  async function save() {
    if (!workspace) return;
    if (process.env.NODE_ENV === "development") console.info("pallet save clicked", { deliveryNumber });
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        updatedAt: workspace.updatedAt,
        pallets: draft.map(({ id, sequenceNumber, actualWeightKg, note }) => ({
          ...(id ? { id } : {}),
          sequenceNumber,
          actualWeightKg,
          note,
        })),
      };
      const path = `/api/deliveries/${deliveryId}/pallets`;
      if (process.env.NODE_ENV === "development") console.info("pallet-save request sent", { path, method: "PUT" });
      const result = await readResponse(await fetch(path, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }));
      setWorkspace(result.data);
      setDraft(result.data.pallets);
      setSuccess("Pallet records saved.");
      router.refresh();
      toast.success("Pallets saved successfully.");
      setOpen(false);
    } catch (requestError) {
      if (process.env.NODE_ENV === "development") console.error("pallet-save request failed", requestError);
      setError(requestError instanceof Error ? requestError.message : "The pallets could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function clearCapture() {
    if (!workspace || !window.confirm("Clear all actual pallet data for this Delivery? This keeps the delivery and its history.")) return;
    setPending(true);
    setError(null);
    try {
      const result = await readResponse(await fetch(`/api/deliveries/${deliveryId}/pallets`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updatedAt: workspace.updatedAt }),
      }));
      setWorkspace(result.data);
      setDraft([]);
      setSuccess("Actual pallet capture cleared.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The pallet capture could not be cleared.");
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
        <div aria-labelledby={`pallet-dialog-${deliveryId}`} aria-modal="true" className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm" role="dialog">
          <div className="border-border bg-background w-full max-w-2xl rounded-xl border shadow-xl">
            <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-foreground font-semibold" id={`pallet-dialog-${deliveryId}`}>Manage pallets</h2>
                <p className="text-muted-foreground mt-1 text-sm">Delivery {workspace?.deliveryNumber ?? deliveryNumber} · Order {workspace?.orderNumber ?? ""}</p>
              </div>
              <Button aria-label="Close pallet manager" onClick={() => setOpen(false)} size="icon-sm" type="button" variant="ghost"><X /></Button>
            </div>
            <div className="space-y-4 px-5 py-4">
              {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
              {success ? <p className="text-primary text-sm" role="status">{success}</p> : null}
              {!workspace && !error ? <p className="text-muted-foreground text-sm">Loading pallet records…</p> : null}
              {workspace ? <>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                  <div><dt className="text-muted-foreground">SAP gross</dt><dd className="font-medium">{formatSapWeight(workspace.sapGrossWeightKg) ?? "Not available"}</dd></div>
                  <div><dt className="text-muted-foreground">Estimated pallets</dt><dd className="font-medium">{estimatePalletCount(workspace.sapGrossWeightKg) ?? "Not available"}</dd></div>
                  <div><dt className="text-muted-foreground">Actual pallets</dt><dd className="font-medium">{draft.length || "Not captured"}</dd></div>
                  <div><dt className="text-muted-foreground">Actual weight</dt><dd className="font-medium">{formatSapWeight(draftSummary.actualPalletWeightKg) ?? "Not captured"}</dd></div>
                  <div><dt className="text-muted-foreground">Variance</dt><dd className="font-medium">{draftSummary.varianceKg ? formatSapWeight(draftSummary.varianceKg) : "Not available"}</dd></div>
                </dl>
                {draft.length === 0 ? <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm">No actual pallet data captured yet.</p> : <div className="border-border overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[420px] text-sm"><thead className="bg-muted/40"><tr><th className="px-3 py-2 text-left">Pallet</th><th className="px-3 py-2 text-left">Actual weight (kg)</th><th className="px-3 py-2"><span className="sr-only">Actions</span></th></tr></thead><tbody>
                    {draft.map((pallet, index) => <tr className="border-border border-t" key={pallet.id ?? `new-${index}`}><td className="px-3 py-2">{pallet.sequenceNumber}</td><td className="px-3 py-2"><input aria-label={`Pallet ${pallet.sequenceNumber} actual weight in kilograms`} className="border-input bg-background h-9 w-full rounded-md border px-2" inputMode="decimal" onChange={(event) => updateWeight(index, event.target.value)} value={pallet.actualWeightKg} /></td><td className="px-3 py-2 text-right"><Button aria-label={`Remove pallet ${pallet.sequenceNumber}`} onClick={() => removePallet(index)} size="icon-xs" type="button" variant="ghost"><Trash2 /></Button></td></tr>)}
                  </tbody></table>
                </div>}
                <Button onClick={addPallet} size="sm" type="button" variant="outline"><Plus />Add another pallet</Button>
              </> : null}
            </div>
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-4">{workspace && draft.length > 0 ? <Button disabled={pending} onClick={clearCapture} type="button" variant="destructive">Clear pallet capture</Button> : null}<Button disabled={pending} onClick={() => setOpen(false)} type="button" variant="outline">Cancel</Button><Button disabled={pending || !workspace || draft.length === 0} onClick={save} type="button"><Save />{pending ? "Saving…" : "Save pallets"}</Button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
