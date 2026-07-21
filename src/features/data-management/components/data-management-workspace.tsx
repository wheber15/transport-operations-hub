"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImportClassificationLabel } from "@/features/data-management/domain/preview";
import { dataImportPaths, dataImportRequest } from "@/features/data-management/lib/api-client";

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
  importType: "deliveryReference" | "operationalSchedule" | "sapOrderBook";
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
type RawPreview = {
  columns: { index: number; label: string }[];
  rows: { sourceRowNumber: number; values: string[] }[];
  meta: { page: number; pageSize: number; total: number };
};
type PreviewRow = {
  sourceRowNumber: number;
  identifier: string | null;
  classification: string;
  classificationLabel: string;
  message: string;
  displayValues: Record<string, string | null>;
  currentValues: Record<string, string | null>;
  proposedValues: Record<string, string | null>;
  issues: string[];
};
type EnhancedPreview = {
  importType: ActiveBatch["importType"];
  mappedFields: string[];
  rows: PreviewRow[];
  counts: Record<string, number>;
  meta: { page: number; pageSize: number; total: number };
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
  sapOrderBook: [],
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
  shippingPoint: "Shipping Point",
};
const deliveryColumns = [
  "deliveryNumber",
  "customerName",
  "orderNumber",
  "goodsIssueDate",
  "shipToNumber",
  "routeCode",
  "grossWeightKg",
  "shipmentNumber",
] as const;
const scheduleColumns = [
  "deliveryNumber",
  "customerName",
  "orderNumber",
  "scheduledDispatchDate",
  "scheduleSource",
  "sourceReference",
] as const;
function displayCell(value: string | null | undefined) {
  if (!value) return <span aria-label="Blank cell" className="bg-muted/50 block min-h-5" />;
  return (
    <span className="block truncate" title={value}>
      {value}
    </span>
  );
}
export function DataManagementWorkspace({ batches }: { batches: Batch[] }) {
  const input = useRef<HTMLInputElement>(null);
  const workflowVersion = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ActiveBatch["importType"]>("deliveryReference");
  const [active, setActive] = useState<ActiveBatch | null>(null);
  const [headers, setHeaders] = useState<Header[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rawPreview, setRawPreview] = useState<RawPreview | null>(null);
  const [preview, setPreview] = useState<EnhancedPreview | null>(null);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewClassification, setPreviewClassification] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const actionable =
    (preview?.counts.validUpdate ?? 0) +
    (preview?.counts.readyToCreate ?? 0) +
    (preview?.counts.readyToUpdate ?? 0) +
    (preview?.counts.alreadyAssignedToShipment ?? 0);
  const headerOptions = useMemo(
    () => headers.filter((header) => header.label && !header.duplicate),
    [headers]
  );
  async function loadBatch(id: string) {
    const data = await dataImportRequest<ActiveBatch>(dataImportPaths.batch(id), { method: "GET" });
    if (data.id !== id) throw new Error("Import batch was not found.");
    setActive(data);
    return data as ActiveBatch;
  }
  async function loadRows(
    id: string,
    view: "raw" | "preview",
    page = 1,
    options?: { query?: string; classification?: string; pageSize?: number }
  ) {
    const search = new URLSearchParams({
      view,
      page: String(page),
      pageSize: String(options?.pageSize ?? pageSize),
    });
    if (view === "preview" && options?.query) search.set("query", options.query);
    if (view === "preview" && options?.classification)
      search.set("classification", options.classification);
    const data = await dataImportRequest<RawPreview | EnhancedPreview>(
      `${dataImportPaths.rows(id)}?${search.toString()}`,
      { method: "GET" }
    );
    if (view === "raw") setRawPreview(data as RawPreview);
    else setPreview(data as EnhancedPreview);
  }
  async function upload() {
    if (!file) return;
    const version = ++workflowVersion.current;
    setBusy(true);
    setMessage(null);
    setActive(null);
    setHeaders([]);
    setMapping({});
    setRawPreview(null);
    setPreview(null);
    setConfirmed(false);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("importType", type);
      const data = await dataImportRequest<{ id: string }>(dataImportPaths.upload(), {
        method: "POST",
        body,
      });
      if (version !== workflowVersion.current) return;
      const batch = await loadBatch(data.id);
      if (version !== workflowVersion.current) return;
      setHeaders([]);
      setMapping({});
      setRawPreview(null);
      setPreview(null);
      if (batch.importType === "sapOrderBook") {
        await loadRows(batch.id, "preview", 1, { pageSize: 20 });
        setMessage("SAP Order Book staged. Review normalized delivery records before committing.");
      } else {
        setMessage("Workbook staged. Select the sheet that contains the operational table.");
      }
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
      await dataImportRequest(dataImportPaths.sheet(active.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName }),
      });
      await loadBatch(active.id);
      setHeaders([]);
      setMapping({});
      setRawPreview(null);
      setPreview(null);
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
      const data = await dataImportRequest<{ headers: Header[] }>(
        dataImportPaths.header(active.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headerRow }),
        }
      );
      setHeaders(data.headers);
      setMapping({});
      setPreview(null);
      setActive({ ...active, selectedHeaderRow: headerRow });
      await loadRows(active.id, "raw", 1, { pageSize: 20 });
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
      await dataImportRequest(dataImportPaths.mapping(active.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importType: active.importType,
          headerRow: active.selectedHeaderRow,
          selectedSheetName: active.selectedSheetName,
          mapping,
        }),
      });
      const data = await dataImportRequest<{ status: string }>(dataImportPaths.preview(active.id), {
        method: "POST",
      });
      await loadRows(active.id, "preview", 1, { pageSize: 20 });
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
      if (process.env.NODE_ENV === "development")
        console.info("[data-import] commit button clicked");
      const data = await dataImportRequest<{
        status: string;
        committedAt: string | null;
        importedRows: number;
        skippedRows: number;
        failedRows: number;
      }>(dataImportPaths.commit(active.id), { method: "POST" });
      if (process.env.NODE_ENV === "development")
        console.info("[data-import] commit request completed");
      setActive({
        ...active,
        status: data.status,
        committedAt: data.committedAt,
        importedRows: data.importedRows,
        skippedRows: data.skippedRows,
        failedRows: data.failedRows,
      });
      await loadRows(active.id, "preview", 1, { pageSize });
      setMessage(
        `Import complete: ${data.importedRows} rows updated and ${data.skippedRows} skipped.`
      );
    } catch (error) {
      if (process.env.NODE_ENV === "development")
        console.warn("[data-import] commit request failed");
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
            <option value="sapOrderBook">SAP Order Book</option>
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
          {active.importType !== "sapOrderBook" ? (
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
          ) : null}
          {active.selectedSheetName && active.importType !== "sapOrderBook" ? (
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
          {rawPreview ? (
            <section className="border-border rounded-xl border p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold">4. Source spreadsheet preview</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Read-only rows beginning after the selected header row. {rawPreview.meta.total}{" "}
                    data rows available.
                  </p>
                </div>
                <span className="text-muted-foreground text-xs">Page {rawPreview.meta.page}</span>
              </div>
              <div className="mt-4 max-h-[26rem] overflow-auto rounded-md border">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="bg-muted/90 text-muted-foreground sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="bg-muted/90 sticky left-0 z-20 min-w-16 border-r p-2 text-right font-medium">
                        Row
                      </th>
                      {rawPreview.columns.map((column) => (
                        <th className="min-w-40 p-2 font-medium" key={column.index}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawPreview.rows.map((row) => (
                      <tr className="border-border border-t" key={row.sourceRowNumber}>
                        <td className="bg-muted/50 sticky left-0 z-10 border-r p-2 text-right tabular-nums">
                          {row.sourceRowNumber}
                        </td>
                        {rawPreview.columns.map((column) => (
                          <td className="max-w-64 min-w-40 p-2" key={column.index}>
                            {displayCell(row.values[column.index])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PreviewPagination
                meta={rawPreview.meta}
                onPage={(page) =>
                  loadRows(active.id, "raw", page, { pageSize: rawPreview.meta.pageSize })
                }
                onPageSize={(size) => void loadRows(active.id, "raw", 1, { pageSize: size })}
              />
            </section>
          ) : null}
          {headers.length ? (
            <section className="border-border rounded-xl border p-5">
              <h2 className="font-semibold">5. Confirm column mapping</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Suggestions are not applied automatically. Required fields must be mapped before
                preview.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {targets[active.importType].map((target) => (
                  <label className="grid gap-1 rounded-lg border p-3 text-sm" key={target}>
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
                          {header.label}
                        </option>
                      ))}
                    </select>
                    {mapping[target] ? (
                      <span className="text-muted-foreground text-xs">
                        <span className="font-medium">Selected source:</span> {mapping[target]}
                        {headerOptions
                          .find((header) => header.label === mapping[target])
                          ?.sampleValues.filter(Boolean).length ? (
                          <span className="mt-1 block">
                            Samples:{" "}
                            {headerOptions
                              .find((header) => header.label === mapping[target])
                              ?.sampleValues.filter(Boolean)
                              .join(", ")}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        No source column will be used.
                      </span>
                    )}
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
          {preview ? (
            <section className="border-border rounded-xl border p-5">
              <h2 className="font-semibold">6. Review import preview</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {actionable > 0
                  ? `${actionable} ${active.importType === "operationalSchedule" ? "rows ready to create or update a schedule" : "rows ready to update"}. Rows are revalidated when you commit.`
                  : "No rows can be committed. Review the issues below."}
              </p>
              <PreviewSummary counts={preview.counts} importType={active.importType} />
              <form
                className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadRows(active.id, "preview", 1, {
                    query: previewQuery,
                    classification: previewClassification,
                    pageSize,
                  });
                }}
              >
                <label className="border-input flex h-10 items-center gap-2 rounded-md border px-3">
                  <Search aria-hidden="true" className="text-muted-foreground size-4" />
                  <span className="sr-only">Search delivery number or customer name</span>
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    onChange={(event) => setPreviewQuery(event.target.value)}
                    placeholder="Search delivery number or customer"
                    value={previewQuery}
                  />
                </label>
                <select
                  aria-label="Filter preview by classification"
                  className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                  onChange={(event) => setPreviewClassification(event.target.value)}
                  value={previewClassification}
                >
                  <option value="">All classifications</option>
                  {Object.keys(preview.counts).map((classification) => (
                    <option key={classification} value={classification}>
                      {getImportClassificationLabel(classification)}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline">
                  Apply
                </Button>
              </form>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-muted/90 text-muted-foreground sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="min-w-16 p-3">Row</th>
                      {previewColumns(active.importType, preview.mappedFields).map((column) => (
                        <th className="min-w-36 p-3" key={column}>
                          {labels[column]}
                        </th>
                      ))}
                      <th className="min-w-36 p-3">Classification</th>
                      <th className="min-w-64 p-3">Message</th>
                      <th className="min-w-24 p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr
                        className="border-border border-t"
                        key={`${row.sourceRowNumber}-${row.identifier}`}
                      >
                        <td className="p-3">{row.sourceRowNumber}</td>
                        {previewColumns(active.importType, preview.mappedFields).map((column) => (
                          <td
                            className="max-w-64 p-3"
                            key={column}
                            title={
                              column === "grossWeightKg"
                                ? (row.displayValues.grossWeightRaw ?? undefined)
                                : (row.displayValues[column] ?? undefined)
                            }
                          >
                            {displayCell(row.displayValues[column])}
                          </td>
                        ))}
                        <td>
                          <span
                            className="rounded-full border px-2 py-1 text-xs"
                            title={row.classification}
                          >
                            {row.classificationLabel}
                          </span>
                        </td>
                        <td className="p-3">{row.message}</td>
                        <td className="p-3">
                          {row.issues.length || active.importType === "sapOrderBook" ? (
                            <RowDetails row={row} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PreviewPagination
                meta={preview.meta}
                onPage={(page) =>
                  loadRows(active.id, "preview", page, {
                    query: previewQuery,
                    classification: previewClassification,
                    pageSize,
                  })
                }
                onPageSize={(size) => {
                  setPageSize(size);
                  void loadRows(active.id, "preview", 1, {
                    query: previewQuery,
                    classification: previewClassification,
                    pageSize: size,
                  });
                }}
              />
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
                    <CheckCircle2 aria-hidden="true" /> Confirm import
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

function previewColumns(importType: ActiveBatch["importType"], mappedFields: string[]) {
  const fields =
    importType === "deliveryReference"
      ? deliveryColumns
      : importType === "operationalSchedule"
        ? scheduleColumns
        : [
            "deliveryNumber",
            "orderNumber",
            "customerName",
            "shipToNumber",
            "routeCode",
            "goodsIssueDate",
            "grossWeightKg",
            "shippingPoint",
          ];
  return fields.filter((field) => field === "deliveryNumber" || mappedFields.includes(field));
}

function PreviewSummary({
  counts,
  importType,
}: {
  counts: Record<string, number>;
  importType: ActiveBatch["importType"];
}) {
  const entries = [
    [
      "validUpdate",
      importType === "operationalSchedule" ? "Ready to create schedule" : "Ready to update",
    ],
    ["unchanged", "No change"],
    ["relatedRecordNotFound", "Delivery not found"],
    ["duplicateRow", "Duplicate"],
    ["conflict", "Conflict"],
    ["missingRequiredValue", "Missing value"],
    ["invalidDate", "Invalid date"],
    ["invalidWeight", "Invalid weight"],
    ["unsupportedField", "Unsupported"],
    ["unavailableRecord", "Unavailable"],
    ["readyToCreate", "Ready to create"],
    ["readyToUpdate", "Ready to update"],
    ["missingDetailRow", "Missing detail row"],
    ["requiresReview", "Requires review"],
    ["alreadyAssignedToShipment", "Assigned to Shipment"],
  ].filter(([classification]) => counts[classification] !== undefined);
  return (
    <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(([classification, label]) => (
        <div className="bg-muted/40 rounded-md px-3 py-2" key={classification}>
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums">{counts[classification]}</dd>
        </div>
      ))}
    </dl>
  );
}

function PreviewPagination({
  meta,
  onPage,
  onPageSize,
}: {
  meta: { page: number; pageSize: number; total: number };
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{meta.total} rows</span>
      <div className="flex items-center gap-2">
        <label className="text-muted-foreground" htmlFor="preview-page-size">
          Rows per page
        </label>
        <select
          className="border-input bg-background h-9 rounded-md border px-2"
          id="preview-page-size"
          onChange={(event) => onPageSize(Number(event.target.value))}
          value={meta.pageSize}
        >
          {[20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <Button
          aria-label="Previous preview page"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-20 text-center tabular-nums">
          {meta.page} / {pages}
        </span>
        <Button
          aria-label="Next preview page"
          disabled={meta.page >= pages}
          onClick={() => onPage(meta.page + 1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function RowDetails({ row }: { row: PreviewRow }) {
  const fields = [
    ...new Set([...Object.keys(row.proposedValues), ...Object.keys(row.currentValues)]),
  ];
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium underline underline-offset-4">
        Inspect
      </summary>
      <div className="bg-muted/40 mt-2 grid min-w-72 gap-2 rounded-md p-3 text-xs">
        {fields.map((field) => (
          <div className="grid grid-cols-[8rem_1fr] gap-2" key={field}>
            <span className="text-muted-foreground">{labels[field] ?? field}</span>
            <span>Imported: {formatDetailValue(row.proposedValues[field])}</span>
            {row.currentValues[field] ? (
              <>
                <span />
                <span>Current: {formatDetailValue(row.currentValues[field])}</span>
              </>
            ) : null}
          </div>
        ))}
        {row.issues.map((issue) => (
          <p className="text-destructive" key={issue}>
            {issue}
          </p>
        ))}
      </div>
    </details>
  );
}

function formatDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Blank";
  return typeof value === "string" ? value : JSON.stringify(value);
}
