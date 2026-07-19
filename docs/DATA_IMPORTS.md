# Data Imports

## Purpose

Data Management provides authenticated, preview-first spreadsheet imports for approved operational updates. It complements SAP; it does not provide a direct SAP integration or arbitrary database editor.

## Workflow

Upload a `.xlsx` or `.csv` file, select a sheet, select a header row (1–20), confirm manual column mapping, review the server-generated preview, and explicitly commit. The client never provides authoritative classifications or row mutations. Each commit revalidates current database state.

## Limits and security

Files are limited to 10 MB, 10,000 rows, 100 columns, and 2,000 characters per cell. Original workbooks are never retained. Formula cells are rejected when mapped; macros and external links are never executed. Identifiers are strings: surrounding whitespace is trimmed while leading zeroes remain intact.

## Import types

- **Delivery reference:** matches an existing Delivery. It may update only its active Order's SAP Goods Issue Date, Ship-To Number, Route Code, and SAP Gross Weight. Shipment Number is preview-only. No records are created, identifiers are immutable, and empty cells never overwrite existing values.
- **Operational schedule:** matches an existing Delivery and creates or updates one schedule per `Delivery + Source`. It never overwrites SAP Goods Issue Date.

Dates accept `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, and Excel serial values. SAP gross weight uses decimal-safe European kilogram parsing. Duplicate business keys are rejected; the final duplicate never wins silently.

## Results, audit, and retention

Every row has a primary classification. Missing values, invalid identifiers, duplicates, invalid dates or weights, missing/unavailable records, conflicts, unsupported values, updates, and unchanged rows are considered in that order. Commit supports expected row-level skips but rolls back the transaction on unexpected failure. One factual Activity records the completed batch.

Result CSV exports include only source row, identifier, classification, and message, with formula-injection neutralization. Abandoned uncommitted batches are eligible for deletion after seven days. Terminal batch summaries remain; detailed staged values are purgeable after 90 days. Cleanup is a service capability only—automatic scheduling is not implemented.

## Current limitations

Manual editing, direct SAP APIs, recurring synchronization, automatic cleanup scheduling, pallet capture, and record creation are out of scope.
