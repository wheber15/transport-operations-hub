"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Batch = {
  id: string;
  importType: string;
  status: string;
  originalFileName: string;
  createdAt: Date;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  committedAt: Date | null;
  uploadedBy?: { displayName: string };
};
type ActiveBatch = {
  id: string;
  importType: "deliveryReference" | "operationalSchedule";
  status: string;
  originalFileName: string;
  selectedSheetName: string | null;
  selectedHeaderRow: number | null;
  sheets: { name: string; rowCount: number; columnCount: number }[];
  committedAt?: string | null;
  importedRows?: number;
  skippedRows?: number;
  failedRows?: number;
};
type Header = { label: string; index: number; sampleValues: string[]; duplicate: boolean };
type PreviewRow = {
  sourceRowNumber: number;
  identifier: string | null;
  classification: string;
  message: string;
  currentValues: Record<string, unknown> | null;
  proposedValues: Record<string, unknown> | null;
};
const targets = {
  deliveryReference: [
    "deliveryNumber",
    "orderNumber",
    "customerName",
    "goodsIssueDate",
    "shipToNumber",
    "routeCode",
    "grossWeightKg",
    "shipmentNumber",
  ],
  operationalSchedule: [
    "deliveryNumber",
    "orderNumber",
    "customerName",
    "scheduledDispatchDate",
    "scheduleSource",
    "sourceReference",
  ],
} as const;
const labels: Record<string, string> = {
  deliveryNumber: "Delivery Number",
  orderNumber: "Order Number",
  customerName: "Customer Name",
  goodsIssueDate: "SAP Goods Issue Date",
  shipToNumber: "Ship-To Number",
  routeCode: "Route Code",
  grossWeightKg: "SAP Gross Weight",
  shipmentNumber: "Shipment Number (preview only)",
  scheduledDispatchDate: "Scheduled Dispatch Date",
  scheduleSource: "Schedule Source",
  sourceReference: "Source Reference",
};
async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "The request could not be completed.");
  return body.data;
}

export function DataManagementWorkspace({ batches }: { batches: Batch[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ActiveBatch["importType"]>("deliveryReference");
  const [active, setActive] = useState<ActiveBatch | null>(null);
  const [headers, setHeaders] = useState<Header[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const actionable = preview.filter((row) => row.classification === "validUpdate").length;
  const headerOptions = useMemo(
    () => headers.filter((header) => header.label && !header.duplicate),
    [headers]
  );
  async function loadBatch(id: string) {
    const data = await request(`/api/data-imports/${id}`);
    setActive(data);
    return data as ActiveBatch;
  }
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("importType", type);
      const data = await request("/api/data-imports/upload", { method: "POST", body });
      await loadBatch(data.id);
      setHeaders([]);
      setMapping({});
      setPreview([]);
      setMessage("Workbook staged. Select the sheet that contains the operational table.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function chooseSheet(sheetName: string) {
    if (!active) return;
    setBusy(true);
    try {
      await request(`/api/data-imports/${active.id}/sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName }),
      });
      await loadBatch(active.id);
      setHeaders([]);
      setMapping({});
      setPreview([]);
      setMessage("Select the row containing the source column headers.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sheet selection failed.");
    } finally {
      setBusy(false);
    }
  }
  async function chooseHeader(headerRow: number) {
    if (!active) return;
    setBusy(true);
    try {
      const data = await request(`/api/data-imports/${active.id}/header`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headerRow }),
      });
      setHeaders(data.headers);
      setMapping({});
      setPreview([]);
      setActive({ ...active, selectedHeaderRow: headerRow });
      setMessage("Confirm each column mapping before previewing the import.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Header selection failed.");
    } finally {
      setBusy(false);
    }
  }
  async function saveAndPreview() {
    if (!active || !active.selectedHeaderRow || !active.selectedSheetName) return;
    setBusy(true);
    try {
      await request(`/api/data-imports/${active.id}/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importType: active.importType,
          headerRow: active.selectedHeaderRow,
          selectedSheetName: active.selectedSheetName,
          mapping,
        }),
      });
      const data = await request(`/api/data-imports/${active.id}/preview`, { method: "POST" });
      setPreview(data.rows);
      setActive({ ...active, status: data.status });
      setConfirmed(false);
      setMessage("Preview is ready. Review row classifications before confirming the import.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!active || !confirmed) return;
    setBusy(true);
    try {
      const data = await request(`/api/data-imports/${active.id}/commit`, { method: "POST" });
      setActive({
        ...active,
        status: data.status,
        committedAt: data.committedAt,
        importedRows: data.importedRows,
        skippedRows: data.skippedRows,
        failedRows: data.failedRows,
      });
      const results = await request(`/api/data-imports/${active.id}/results`);
      setPreview(results.rows);
      setMessage(
        `Import complete: ${data.importedRows} rows updated and ${data.skippedRows} skipped.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Commit failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
      <header>
        <p className="text-primary text-sm font-medium">Operations</p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Data Management
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
          Review and import approved operational data. Imports never create records or reassign
          shipments, and every update is previewed before it is committed.
        </p>
      </header>
      <section className="border-border rounded-xl border p-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="text-primary mt-0.5 size-5" />
          <div>
            <h2 className="font-semibold">1. Upload spreadsheet</h2>
            <p className="text-muted-foreground text-sm">
              .xlsx or .csv · maximum 10 MB · original files are not retained.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label
            className="border-input flex min-h-11 cursor-pointer items-center rounded-md border px-3 text-sm"
            htmlFor="spreadsheet-file"
          >
            {file ? file.name : "Choose spreadsheet"}
            <input
              accept=".xlsx,.csv"
              className="sr-only"
              id="spreadsheet-file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              ref={input}
              type="file"
            />
          </label>
          <select
            aria-label="Import type"
            className="border-input bg-background h-11 rounded-md border px-3 text-sm"
            onChange={(event) => setType(event.target.value as ActiveBatch["importType"])}
            value={type}
          >
            <option value="deliveryReference">Delivery reference import</option>
            <option value="operationalSchedule">Operational schedule import</option>
          </select>
          <Button disabled={!file || busy} onClick={upload} type="button">
            <Upload aria-hidden="true" />
            {busy ? "Staging…" : "Upload and stage"}
          </Button>
        </div>
        {message ? (
          <p aria-live="polite" className="mt-3 text-sm">
            {message}
          </p>
        ) : null}
      </section>
      {active ? (
        <>
          <section className="border-border rounded-xl border p-5">
            <h2 className="font-semibold">2. Select sheet</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.sheets.map((sheet) => (
                <button
                  aria-pressed={active.selectedSheetName === sheet.name}
                  className={`rounded-lg border p-4 text-left text-sm ${active.selectedSheetName === sheet.name ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                  disabled={busy}
                  key={sheet.name}
                  onClick={() => chooseSheet(sheet.name)}
                  type="button"
                >
                  <span className="font-medium">{sheet.name}</span>
                  <span className="text-muted-foreground mt-1 block">
                    {sheet.rowCount} rows · {sheet.columnCount} columns
                  </span>
                </button>
              ))}
            </div>
          </section>
          {active.selectedSheetName ? (
            <section className="border-border rounded-xl border p-5">
              <h2 className="font-semibold">3. Select header row</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Choose the row that names the spreadsheet columns.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from(
                  {
                    length: Math.min(
                      20,
                      active.sheets.find((sheet) => sheet.name === active.selectedSheetName)
                        ?.rowCount ?? 0
                    ),
                  },
                  (_, index) => index + 1
                ).map((row) => (
                  <Button
                    key={row}
                    onClick={() => chooseHeader(row)}
                    size="sm"
                    type="button"
                    variant={active.selectedHeaderRow === row ? "default" : "outline"}
                  >
                    Row {row}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}
          {headers.length ? (
            <section className="border-border rounded-xl border p-5">
              <h2 className="font-semibold">4. Confirm column mapping</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Suggestions are not applied automatically. Required fields must be mapped before
                preview.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {targets[active.importType].map((target) => (
                  <label className="grid gap-1 text-sm" key={target}>
                    <span className="font-medium">
                      {labels[target]}
                      {["deliveryNumber", "scheduledDispatchDate", "scheduleSource"].includes(
                        target
                      )
                        ? " *"
                        : ""}
                    </span>
                    <select
                      className="border-input bg-background h-10 rounded-md border px-3"
                      onChange={(event) =>
                        setMapping((current) => ({ ...current, [target]: event.target.value }))
                      }
                      value={mapping[target] ?? ""}
                    >
                      <option value="">Do not map</option>
                      {headerOptions.map((header) => (
                        <option key={header.index} value={header.label}>
                          {header.label} —{" "}
                          {header.sampleValues.filter(Boolean).join(", ") || "No sample"}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <Button
                className="mt-5"
                disabled={
                  busy ||
                  !mapping.deliveryNumber ||
                  (active.importType === "operationalSchedule" &&
                    (!mapping.scheduledDispatchDate || !mapping.scheduleSource))
                }
                onClick={saveAndPreview}
                type="button"
              >
                Generate preview
              </Button>
            </section>
          ) : null}
          {preview.length ? (
            <section className="border-border rounded-xl border p-5">
              <h2 className="font-semibold">5. Review preview</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {actionable} actionable rows. Rows are revalidated when you commit.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="p-3">Row</th>
                      <th>Identifier</th>
                      <th>Classification</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr
                        className="border-border border-t"
                        key={`${row.sourceRowNumber}-${row.identifier}`}
                      >
                        <td className="p-3">{row.sourceRowNumber}</td>
                        <td>{row.identifier ?? "—"}</td>
                        <td>
                          <span className="rounded-full border px-2 py-1 text-xs">
                            {row.classification}
                          </span>
                        </td>
                        <td className="p-3">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {active.status !== "committed" ? (
                <div className="mt-5 rounded-lg border p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      checked={confirmed}
                      className="mt-1 size-4"
                      onChange={(event) => setConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      I reviewed the preview. Commit {actionable} approved operational updates.
                    </span>
                  </label>
                  <Button
                    className="mt-4"
                    disabled={!confirmed || actionable === 0 || busy}
                    onClick={commit}
                    type="button"
                  >
                    <CheckCircle2 aria-hidden="true" />
                    Confirm import
                  </Button>
                </div>
              ) : (
                <a
                  className="text-primary mt-4 inline-block text-sm font-medium underline"
                  href={`/api/data-imports/${active.id}/results.csv`}
                >
                  Download result CSV
                </a>
              )}
            </section>
          ) : null}
        </>
      ) : null}
      <section className="border-border rounded-xl border">
        <div className="border-border border-b p-5">
          <h2 className="font-semibold">Import History</h2>
          <p className="text-muted-foreground mt-1 text-sm">Recent staged and completed batches.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-4">File</th>
                <th>Type</th>
                <th>Status</th>
                <th>Uploader</th>
                <th>Rows</th>
                <th className="p-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr className="border-border border-t" key={batch.id}>
                  <td className="p-4 font-medium">{batch.originalFileName}</td>
                  <td>{batch.importType}</td>
                  <td>{batch.status}</td>
                  <td>{batch.uploadedBy?.displayName ?? "—"}</td>
                  <td>{batch.totalRows}</td>
                  <td className="p-4">{new Date(batch.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {batches.length === 0 ? (
            <p className="text-muted-foreground p-5 text-sm">No import batches yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
