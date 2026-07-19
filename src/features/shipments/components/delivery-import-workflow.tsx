"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type {
  DeliveryImportCommit,
  DeliveryImportPreview,
  DeliveryImportResult,
} from "@/features/shipments/types/shipment";

type ImportResponse<T> = { data?: T; error?: { message?: string } };

const classificationPresentation: Record<DeliveryImportResult["classification"], string> = {
  eligible: "Ready to assign",
  alreadyAssignedToTarget: "Already on this shipment",
  assignedToAnotherShipment: "Assigned elsewhere",
  notFound: "Not found",
  unavailableDelivery: "Delivery unavailable",
  unavailableOrder: "Order unavailable",
};

function getClientInputSummary(value: string) {
  const values = value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueValues = new Set(values);
  return { duplicateCount: values.length - uniqueValues.size, uniqueCount: uniqueValues.size };
}

function ImportResults({ results }: { results: DeliveryImportResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="bg-muted/40 text-muted-foreground border-border/80 border-y text-xs font-medium tracking-wide uppercase">
          <tr>
            <th className="px-5 py-3">Delivery</th>
            <th className="px-5 py-3">Order</th>
            <th className="px-5 py-3">Customer</th>
            <th className="px-5 py-3">Current shipment</th>
            <th className="px-5 py-3">Result</th>
          </tr>
        </thead>
        <tbody className="divide-border/80 divide-y">
          {results.map((result) => (
            <tr key={result.deliveryNumber}>
              <td className="text-foreground px-5 py-3.5 font-medium">{result.deliveryNumber}</td>
              <td className="text-muted-foreground px-5 py-3.5">{result.orderNumber ?? "—"}</td>
              <td className="text-muted-foreground px-5 py-3.5">{result.customerName ?? "—"}</td>
              <td className="text-muted-foreground px-5 py-3.5">
                {result.currentShipmentNumber ?? "—"}
              </td>
              <td className="px-5 py-3.5">
                <p className="text-foreground font-medium">
                  {classificationPresentation[result.classification]}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">{result.message}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultSummary({ result }: { result: DeliveryImportCommit }) {
  const entries = [
    ["Assigned", result.assignedCount],
    ["Skipped", result.skippedCount],
    ["Already assigned", result.alreadyAssignedToTargetCount],
    ["Assigned elsewhere", result.assignedElsewhereCount],
    ["Not found", result.notFoundCount],
    ["Delivery unavailable", result.unavailableDeliveryCount],
    ["Order unavailable", result.unavailableOrderCount],
  ];
  return (
    <div className="border-border/80 bg-muted/25 grid gap-3 border-t px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([label, count]) => (
        <p key={label}>
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground ml-2 font-semibold">{count}</span>
        </p>
      ))}
    </div>
  );
}

export function DeliveryImportWorkflow({
  shipmentId,
  shipmentNumber,
}: {
  shipmentId: string;
  shipmentNumber: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<DeliveryImportPreview | null>(null);
  const [commitResult, setCommitResult] = useState<DeliveryImportCommit | null>(null);
  const [pendingAction, setPendingAction] = useState<"preview" | "commit" | null>(null);
  const inputSummary = useMemo(() => getClientInputSummary(input), [input]);
  const eligibleCount =
    preview?.results.filter((result) => result.classification === "eligible").length ?? 0;

  async function previewImport() {
    setPendingAction("preview");
    setCommitResult(null);
    try {
      const response = await fetch(`/api/shipments/${shipmentId}/delivery-import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNumbers: input }),
      });
      const payload = (await response.json()) as ImportResponse<DeliveryImportPreview>;
      if (!response.ok || !payload.data)
        throw new Error(payload.error?.message ?? "Delivery import preview is unavailable.");
      setPreview(payload.data);
      toast.success("Delivery import preview is ready.");
    } catch (error) {
      setPreview(null);
      toast.error(
        error instanceof Error ? error.message : "Delivery import preview is unavailable."
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function commitImport() {
    if (!preview || eligibleCount === 0) return;
    if (
      !window.confirm(`Assign ${eligibleCount} eligible Deliveries to Shipment ${shipmentNumber}?`)
    )
      return;
    setPendingAction("commit");
    try {
      const response = await fetch(`/api/shipments/${shipmentId}/delivery-import/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryNumbers: preview.results.map((result) => result.deliveryNumber),
        }),
      });
      const payload = (await response.json()) as ImportResponse<DeliveryImportCommit>;
      if (!response.ok || !payload.data)
        throw new Error(payload.error?.message ?? "Delivery import could not be completed.");
      setCommitResult(payload.data);
      setPreview(payload.data);
      toast.success(`${payload.data.assignedCount} delivery assignment(s) completed.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Delivery import could not be completed."
      );
    } finally {
      setPendingAction(null);
    }
  }

  function reset() {
    setInput("");
    setPreview(null);
    setCommitResult(null);
  }

  const pending = pendingAction !== null;

  return (
    <section className="border-border/80 bg-card overflow-hidden rounded-xl border shadow-sm">
      <div className="border-border/80 flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
            <ClipboardPaste aria-hidden="true" className="text-muted-foreground size-4" />
            Import SAP deliveries
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Paste SAP Delivery Numbers to assign eligible deliveries to Shipment {shipmentNumber}.
          </p>
        </div>
        <Button
          disabled={pending || (!input && !preview)}
          onClick={reset}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" />
          Reset
        </Button>
      </div>

      <div className="space-y-4 px-5 py-5">
        <label className="block" htmlFor="sap-delivery-numbers">
          <span className="text-foreground text-sm font-medium">SAP Delivery Numbers</span>
          <span className="text-muted-foreground mt-1 block text-xs">
            Separate numbers with lines, tabs, spaces, commas, or semicolons. Maximum 200 unique
            numbers.
          </span>
        </label>
        <textarea
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-32 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          id="sap-delivery-numbers"
          onChange={(event) => {
            setInput(event.target.value);
            setPreview(null);
            setCommitResult(null);
          }}
          placeholder={"800000001\n800000002"}
          value={input}
        />
        <p className="text-muted-foreground text-xs">
          {inputSummary.uniqueCount} unique {inputSummary.uniqueCount === 1 ? "number" : "numbers"}
          {inputSummary.duplicateCount > 0
            ? ` · ${inputSummary.duplicateCount} duplicate ${inputSummary.duplicateCount === 1 ? "entry" : "entries"}`
            : ""}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={pending || input.trim().length === 0}
            onClick={previewImport}
            type="button"
          >
            {pendingAction === "preview" ? "Preparing preview…" : "Preview import"}
          </Button>
          <Button
            disabled={pending || !preview || eligibleCount === 0}
            onClick={commitImport}
            type="button"
            variant="outline"
          >
            {pendingAction === "commit"
              ? "Assigning…"
              : `Confirm import${eligibleCount ? ` (${eligibleCount})` : ""}`}
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="border-border/80 border-t">
          <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-foreground text-sm font-semibold">Import preview</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                {preview.uniqueCount} unique numbers reviewed
                {preview.duplicateInputCount > 0
                  ? ` · ${preview.duplicateInputCount} duplicate entries ignored`
                  : ""}
              </p>
            </div>
            <p className="text-foreground text-sm font-medium">{eligibleCount} ready to assign</p>
          </div>
          <ImportResults results={preview.results} />
          {commitResult ? <ResultSummary result={commitResult} /> : null}
        </div>
      ) : null}
    </section>
  );
}
