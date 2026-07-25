"use client";

import { Download, FileSpreadsheet, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { Button } from "@/components/ui/button";

type Carrier = { id: string; carrierNumber: string; name: string };
type Preview = {
  baseline: { id: string; reference: string } | null;
  blockers: Array<{
    code: string;
    deliveryNumber: string | null;
    message: string;
    orderId?: string;
    orderNumber?: string;
    orderUnavailable?: boolean;
  }>;
  counts: { added: number; changed: number; removed: number; unchanged: number };
  exportRows: Array<{
    linkedOrderCount: number;
    linkedOrderNumbers: string[];
    row: {
      deliveryNumber: string | null;
      salesOrderNumber: string | null;
      totalWeightKg: string | null;
      palletUnit: number | null;
    };
  }>;
  totalPallets: number;
  totalWeightKg: string;
  diagnostics: {
    inactiveDeliveries: number;
    inactiveLinkedOrders: number;
    mixedLinkedOrderStates: number;
    blockedActiveDeliveries: number;
    validationIssueCount: number;
    blockedDeliveries: Array<{
      deliveryNumber: string | null;
      blockers: Array<{
        code: string;
        message: string;
        orderId?: string;
        orderNumber?: string;
        orderUnavailable?: boolean;
      }>;
    }>;
    excludedRecords: Array<{
      deliveryNumber: string;
      orderId?: string;
      orderNumber?: string;
      reason: "INACTIVE_DELIVERY" | "INACTIVE_LINKED_ORDER";
    }>;
  };
};
type History = {
  id: string;
  reference: string;
  filename: string | null;
  stage: "INITIAL" | "UPDATE" | "ADDITION";
  sequence: number;
  status: "PENDING" | "GENERATED" | "SENT" | "FAILED" | "CANCELLED";
  rowCount: number;
  totalPallets: number;
  totalWeightKg: string | null;
  generatedByDisplayName: string;
  generatedAt: string | null;
  baselineRun: { id: string; reference: string } | null;
  artifacts: Array<{ status: string; format: string; filename: string | null }>;
};

function errorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = response.headers.get("content-type")?.includes("application/json")
    ? ((await response.json()) as { data?: T; error?: { message?: string } })
    : null;
  if (!response.ok || !payload?.data)
    throw new Error(errorMessage(payload, "The server returned an unexpected response."));
  return payload.data;
}

export function CarrierExportsWorkspace({
  canViewDeletedOrders,
  canMarkSent,
  carriers,
  history,
  migrationReady,
}: {
  canViewDeletedOrders: boolean;
  canMarkSent: boolean;
  carriers: Carrier[];
  history: History[];
  migrationReady: boolean;
}) {
  const router = useRouter();
  const [carrierId, setCarrierId] = useState("");
  const [goodsIssueDate, setGoodsIssueDate] = useState("");
  const [stage, setStage] = useState<"INITIAL" | "UPDATE" | "ADDITION">("INITIAL");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = { carrierId, goodsIssueDate, stage };

  const orderHref = (orderId: string, orderNumber: string, unavailable = false) =>
    unavailable && canViewDeletedOrders
      ? `/orders?recordState=deleted&query=${encodeURIComponent(orderNumber)}`
      : `/orders/${orderId}`;

  const correctiveAction = (code: string) => {
    if (code === "UNAVAILABLE_LINKED_ORDER") return "Resolve linked Order availability";
    return code.startsWith("CONFLICTING_") ? "Resolve conflicting values" : "Review Order data";
  };

  async function previewExport() {
    setPending(true);
    setError(null);
    try {
      setPreview(await postJson<Preview>("/api/carrier-exports/preview", request));
    } catch (requestError) {
      setPreview(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Carrier Export preview is unavailable."
      );
    } finally {
      setPending(false);
    }
  }

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const result = await postJson<{ filename: string; reference: string }>(
        "/api/carrier-exports",
        request
      );
      toast.success(`${result.filename} generated successfully.`);
      setPreview(null);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Carrier Export generation is unavailable."
      );
    } finally {
      setPending(false);
    }
  }

  async function markSent(id: string) {
    setPending(true);
    try {
      await postJson(`/api/carrier-exports/${id}/sent`, {});
      toast.success("Carrier Export marked as sent.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The Carrier Export could not be marked as sent."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <OperationsPanel aria-label="Create Carrier Export">
        <div className="border-border/80 border-b px-5 py-4">
          <h2 className="text-base font-semibold">Create Dachser export</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Generate a planned XLSX file from the selected Goods Issue date. Shipment Number remains
            blank by specification.
          </p>
        </div>
        {migrationReady ? (
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              Carrier
              <select
                className="border-input bg-background h-9 rounded-md border px-2"
                value={carrierId}
                onChange={(event) => {
                  setCarrierId(event.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Select Carrier</option>
                {carriers.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name} - {carrier.carrierNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Goods Issue date
              <input
                className="border-input bg-background h-9 rounded-md border px-2"
                type="date"
                value={goodsIssueDate}
                onChange={(event) => {
                  setGoodsIssueDate(event.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Export type
              <select
                className="border-input bg-background h-9 rounded-md border px-2"
                value={stage}
                onChange={(event) => {
                  setStage(event.target.value as typeof stage);
                  setPreview(null);
                }}
              >
                <option value="INITIAL">Initial</option>
                <option value="UPDATE">Update</option>
                <option value="ADDITION">Addition</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 md:col-span-3">
              <p className="text-muted-foreground text-sm">
                Initial is a complete first file. Updates replace the full file; Additions include
                only never-sent Deliveries.
              </p>
              <Button
                disabled={pending || !carrierId || !goodsIssueDate}
                onClick={previewExport}
                type="button"
                variant="outline"
              >
                <Sparkles />
                {pending ? "Preparing..." : "Preview export"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground px-5 py-8 text-sm">
            Carrier Exports will become available when the pending additive data migration is
            applied to the selected development database.
          </p>
        )}
        {error ? (
          <p className="text-destructive border-border/80 border-t px-5 py-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </OperationsPanel>

      {preview ? (
        <OperationsPanel aria-label="Carrier Export preview">
          <div className="border-border/80 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">Export preview</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {preview.baseline
                  ? `Comparison baseline: ${preview.baseline.reference}`
                  : "No baseline is required for this Initial export."}
              </p>
            </div>
            <Button
              disabled={pending || preview.exportRows.length === 0}
              onClick={generate}
              type="button"
            >
              <FileSpreadsheet />
              Generate XLSX
            </Button>
          </div>
          <dl className="border-border/80 grid grid-cols-2 gap-3 border-b p-5 md:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs">Deliveries</dt>
              <dd className="mt-1 text-lg font-semibold">{preview.exportRows.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">SAP weight</dt>
              <dd className="mt-1 text-lg font-semibold">{preview.totalWeightKg} kg</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Planned pallets</dt>
              <dd className="mt-1 text-lg font-semibold">{preview.totalPallets}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Changes</dt>
              <dd className="mt-1 text-lg font-semibold">
                +{preview.counts.added} / {preview.counts.changed} changed
              </dd>
            </div>
          </dl>
          {preview.diagnostics.inactiveDeliveries || preview.diagnostics.inactiveLinkedOrders ? (
            <div className="border-border/80 border-b px-5 py-4 text-sm">
              <h3 className="font-semibold">Excluded inactive records</h3>
              <p className="text-muted-foreground mt-1">
                {preview.diagnostics.inactiveDeliveries} inactive Deliveries and{" "}
                {preview.diagnostics.inactiveLinkedOrders} Deliveries with an inactive linked Order
                were excluded from all export totals.
              </p>
              {preview.diagnostics.excludedRecords.slice(0, 25).map((record, index) => (
                <p className="text-muted-foreground mt-1" key={`${record.deliveryNumber}-${index}`}>
                  {record.deliveryNumber}:{" "}
                  {record.reason === "INACTIVE_DELIVERY"
                    ? "inactive Delivery"
                    : "inactive linked Order"}
                  {record.orderId && record.orderNumber ? (
                    <>
                      {" · "}
                      <Link
                        className="text-primary underline"
                        href={orderHref(record.orderId, record.orderNumber, true)}
                      >
                        Order {record.orderNumber}
                      </Link>
                    </>
                  ) : null}
                </p>
              ))}
            </div>
          ) : null}
          {preview.diagnostics.blockedActiveDeliveries ? (
            <div className="border-border/80 border-b px-5 py-4">
              <h3 className="text-destructive text-sm font-semibold">
                {preview.diagnostics.blockedActiveDeliveries} active Deliveries are blocked and will
                be excluded
                {preview.diagnostics.validationIssueCount
                  ? ` (${preview.diagnostics.validationIssueCount} validation issues)`
                  : ""}
              </h3>
              <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                {preview.diagnostics.blockedDeliveries.slice(0, 25).map((delivery, index) => (
                  <li key={`${delivery.deliveryNumber ?? "unavailable"}-${index}`}>
                    <span className="font-medium">
                      {delivery.deliveryNumber ?? "Delivery unavailable"}
                    </span>
                    <ul className="ml-4 list-disc space-y-1">
                      {delivery.blockers.map((blocker, blockerIndex) => (
                        <li key={`${blocker.code}-${blockerIndex}`}>
                          {blocker.message}{" "}
                          {blocker.orderId && blocker.orderNumber ? (
                            <Link
                              className="text-primary underline"
                              href={orderHref(
                                blocker.orderId,
                                blocker.orderNumber,
                                blocker.orderUnavailable
                              )}
                            >
                              Order {blocker.orderNumber}
                            </Link>
                          ) : null}{" "}
                          <span className="font-medium">{correctiveAction(blocker.code)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-5 py-3">Delivery</th>
                  <th className="px-5 py-3">Linked Orders</th>
                  <th className="px-5 py-3">Sales Order</th>
                  <th className="px-5 py-3">Weight</th>
                  <th className="px-5 py-3">Pallets</th>
                </tr>
              </thead>
              <tbody className="divide-border/80 divide-y">
                {preview.exportRows.slice(0, 50).map((item) => (
                  <tr key={item.row.deliveryNumber}>
                    <td className="px-5 py-3 font-medium">{item.row.deliveryNumber}</td>
                    <td className="px-5 py-3">
                      <p>{item.linkedOrderCount}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {item.linkedOrderNumbers.join(", ") || "No linked Orders"}
                      </p>
                    </td>
                    <td className="px-5 py-3">{item.row.salesOrderNumber ?? "Not set"}</td>
                    <td className="px-5 py-3">{item.row.totalWeightKg} kg</td>
                    <td className="px-5 py-3">{item.row.palletUnit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OperationsPanel>
      ) : null}

      <OperationsPanel aria-label="Carrier Export history">
        <div className="border-border/80 border-b px-5 py-4">
          <h2 className="text-base font-semibold">Export history</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Generated and sent export artifacts are preserved for audit.
          </p>
        </div>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Rows</th>
                  <th className="px-5 py-3">Pallets</th>
                  <th className="px-5 py-3">Baseline</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border/80 divide-y">
                {history.map((run) => (
                  <tr key={run.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{run.filename ?? run.reference}</p>
                      <p className="text-muted-foreground text-xs">{run.reference}</p>
                    </td>
                    <td className="px-5 py-3">
                      {run.stage === "INITIAL"
                        ? "Initial"
                        : run.stage === "UPDATE"
                          ? `Update (${run.sequence})`
                          : `Addition (${run.sequence})`}
                    </td>
                    <td className="px-5 py-3">{run.status}</td>
                    <td className="px-5 py-3">{run.rowCount}</td>
                    <td className="px-5 py-3">{run.totalPallets}</td>
                    <td className="px-5 py-3">{run.baselineRun?.reference ?? "-"}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {run.artifacts.some(
                          (artifact) =>
                            artifact.format === "XLSX" && artifact.status === "COMPLETED"
                        ) ? (
                          <Button
                            nativeButton={false}
                            render={<a href={`/api/carrier-exports/${run.id}/artifact`} />}
                            size="xs"
                            variant="outline"
                          >
                            <Download />
                            Download
                          </Button>
                        ) : null}
                        {canMarkSent && run.status === "GENERATED" ? (
                          <Button
                            disabled={pending}
                            onClick={() => markSent(run.id)}
                            size="xs"
                            type="button"
                            variant="outline"
                          >
                            <Send />
                            Mark sent
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description="Generated Carrier Exports will appear here."
            icon={FileSpreadsheet}
            title="No Carrier Exports yet"
          />
        )}
      </OperationsPanel>
    </div>
  );
}
