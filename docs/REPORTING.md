# Reporting Foundation

## Scope

The Reporting foundation provides immutable Daily Orders report snapshots, history, administrator deletion, and private XLSX generation. PDF rendering is not implemented.

## Current release scope

Daily Orders is the only implemented report in this release. The Reports workspace labels the following cards as **Coming Soon** and does not expose them as interactive reports: Daily Shipments, Trailer Planning, Pallet Summary, Planned vs Actual Weight, Pallet Accuracy, Carrier Performance, Weekly Operations, Monthly Operations, and KPI Summary.

Each future report requires its own approved data contract, calculation definitions, snapshot rules, and presentation specification. They are roadmap items, not completed reporting functionality.

## Snapshot lifecycle

`PENDING → GENERATING → COMPLETED` is the successful lifecycle. A run may become `FAILED` from `PENDING` or `GENERATING`. Completed and failed runs are never reopened; retrying creates a new run and reference.

A report run becomes `COMPLETED` after its ordered, immutable snapshot rows, KPI snapshot, exception snapshot, and dataset checksum are persisted. XLSX generation is tracked independently on the requested artifact. A completed snapshot remains immutable even if later artifact generation fails; retrying uses a new report run and reference.

## Canonical references and deduplication

Daily Orders references use `AXR-ORD-YYYYMMDD-001`. PostgreSQL allocates the date-scoped sequence transactionally with an atomic upsert under a bounded serializable transaction. The report service also takes a transaction-scoped advisory lock for the canonical dataset/filter fingerprint, preventing concurrent duplicate submissions from creating equivalent snapshots.

The persisted filter object is normalized and excludes pagination, UI-only state, unknown values, and secrets. Dataset checksums are SHA-256 over the ordered normalized rows, with stable field ordering, null handling, date serialization, and UTF-8 encoding.

## Immutability and history

Snapshot rows have no update or delete lifecycle. Report runs allow only controlled lifecycle transitions before completion. Snapshot payloads do not foreign-key current operational Orders or Deliveries, so report history remains truthful if operational data later changes or is soft-deleted.

## Artifacts and storage

The artifact model and authenticated download route are present for the next stage. Private local storage is outside `public/`, uses generated storage keys, rejects traversal, writes atomically, and verifies SHA-256 checksums before a file is streamed. Production refuses to fall back to an implicit local artifact directory.

## Roles and audit

Planner and Administrator roles may create snapshots, view history, and request completed artifacts. Failure details are available only to Administrators and remain sanitized. Activities record report request, snapshot completion, safe failure, and completed-artifact download without secrets, paths, stack traces, or raw persistence errors.

# XLSX delivery

Daily Orders reports are created from a frozen report record. An authorised Planner or Administrator can subsequently generate an Excel report from that stored record. Rendering reads only the stored report rows and stored KPI and exception metadata; it never re-queries operational data.

The Excel workbook contains, in order: Executive Summary, Daily Orders, Items Requiring Attention, Trailer Planning, Weight Analysis, Pallet Analysis, and Report Metadata. The file name is deterministic: `AXon Daily Orders Report - YYYY-MM-DD - AXR-ORD-YYYYMMDD-001.xlsx`.

The report record remains completed when its stored data is complete. Excel readiness is tracked independently: `PENDING`, `GENERATING`, `COMPLETED`, or `FAILED`. A completed file is immutable; a failed file requires a new report record and reference. Files are held in private storage, checksum-verified before download, and streamed only through the authenticated download route.

All operational and user-controlled strings are protected from spreadsheet-formula injection. XLSX rendering is capped at the stored report row limit; schema mismatch, invalid stored data, duplicate generation, and storage failures return sanitised stable failures.

# Administrator report deletion

Only Administrators may delete a report. AXon first loads the report and private artifact metadata, rejects a generating report, then removes each private file. If file cleanup fails, the database history remains intact. Once file cleanup succeeds, one database transaction removes artifact metadata, snapshot rows, and the report record, and records `report_deleted` with empty safe metadata. Filesystem and database work are not one atomic transaction: if the database transaction fails after cleanup, AXon returns a sanitised support failure and the private files must be restored from storage backup before retrying.
