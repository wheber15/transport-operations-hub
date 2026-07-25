# Data Imports

## Purpose

Data Management provides authenticated, preview-first spreadsheet imports for approved operational updates. It complements SAP; it does not provide a direct SAP integration or arbitrary database editor.

## Workflow

Upload a `.xlsx` or `.csv` file, select a sheet, select a header row (1–20), confirm manual column mapping, review the server-generated preview, and explicitly commit. The client never provides authoritative classifications or row mutations. Each commit revalidates current database state.

## Limits and security

After selecting a header row, AXon displays a read-only, spreadsheet-style source preview. It begins at the row after the selected header, keeps the source row number visible, shows up to 100 server-provided rows per page, and never transfers a complete workbook to the browser. Formula cells are visibly marked unsupported. Blank cells remain visibly blank.

After mapping, the operational preview displays only approved mapped values. Delivery-reference previews show Delivery Number, mapped Customer Name, Order Number, Goods Issue Date, Ship-To, Route, SAP Gross Weight, and Shipment Number, followed by classification and message. Schedule previews show Delivery Number, mapped Customer Name, Order Number, Scheduled Dispatch Date, Schedule Source, and Source Reference. Unmapped columns are not displayed, apart from Delivery Number and the classification and message columns.

Preview paging is server-side and bounded to 20, 50, or 100 rows. The mapped preview supports server-side Delivery Number or Customer Name search and classification filtering. The summary uses planner-readable classifications such as **Ready to update**, **No change**, and **Delivery not found**. SAP weight keeps raw imported text distinct from its decimal-safe parsed display; for example, `7,000 KG` displays as `7.000 kg` with the original text available on hover.

Files are limited to 10 MB, 10,000 rows, 100 columns, and 2,000 characters per cell. Original workbooks are never retained. Formula cells are rejected when mapped; macros and external links are never executed. Identifiers are strings: surrounding whitespace is trimmed while leading zeroes remain intact.

## Import types

- **Delivery reference:** matches an existing Delivery. It may update only its active Order's SAP Goods Issue Date, Ship-To Number, Route Code, and SAP Gross Weight. Shipment Number is preview-only. No records are created, identifiers are immutable, and empty cells never overwrite existing values.
- **SAP Order Book:** uses **Sales Document** as Delivery Number and **Originating Document** as Order Number. A valid row may create a missing active Customer, Order, Delivery, and Delivery–Order association. Customer identity is the exact active Customer Name supplied by SAP **Name 1**; where no active exact-name Customer exists, AXon creates one with that SAP name. **Ship-To Party** remains a separate Order field. Existing active Orders receive only approved SAP-owned fields (Goods Issue Date, Ship-To Party, Route, Shipping Point, and SAP Gross Weight). Manual Purchase Order Number, shipment planning, and pallet data are never overwritten. A second Originating Document for an existing Delivery creates an association without replacing that Delivery's legacy primary Order.
- **Operational schedule:** matches an existing Delivery and creates or updates one schedule per `Delivery + Source`. It never overwrites SAP Goods Issue Date.

Dates accept `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, and Excel serial values. SAP gross weight uses decimal-safe European kilogram parsing. Duplicate business keys are rejected; the final duplicate never wins silently.

## Results, audit, and retention

Every row has a primary classification. Missing values, invalid identifiers, duplicates, invalid dates or weights, missing/unavailable records, conflicts, unsupported values, updates, and unchanged rows are considered in that order. Commit supports expected row-level skips but rolls back the transaction on unexpected failure. One factual Activity records the completed batch.

Result CSV exports include only source row, identifier, classification, and message, with formula-injection neutralization. Abandoned uncommitted batches are eligible for deletion after seven days. Terminal batch summaries remain; detailed staged values are purgeable after 90 days. Cleanup is a service capability only—automatic scheduling is not implemented.

## Current limitations

Manual editing, direct SAP APIs, recurring synchronization, automatic cleanup scheduling, and pallet capture are out of scope.
