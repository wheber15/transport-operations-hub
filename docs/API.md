# API Architecture

Application API contracts use App Router route handlers with Zod validation, service-layer authorization, repository-only Prisma access, and a consistent `{ data }` or `{ error }` envelope.

## Authentication Architecture

Authentication uses Auth.js v5 with the Next.js App Router. The Auth.js route handlers are exposed only through `/api/auth/[...nextauth]` and use a credentials provider backed by the persisted `User` identity records in PostgreSQL. Passwords are stored only as hashes.

The Prisma adapter is configured for Auth.js compatibility. The identity schema includes Auth.js account, session, and verification-token tables for supported current and future providers. Credentials sign-in uses JWT sessions; authentication cookies are created and invalidated by Auth.js. The adapter `Session` table is not used by the current JWT strategy, but remains part of the supported identity model for future database-session or external-provider requirements.

## Session Flow

1. A user submits credentials to the `/login` server action.
2. Auth.js validates the credentials against the active, database-backed user record.
3. On success, Auth.js issues its signed JWT session cookie.
4. The Next.js `proxy.ts` route guard permits authenticated requests and redirects unauthenticated requests to `/login`. It permits only `/login`, `/api/auth/*`, and required static or metadata assets. Authenticated users visiting `/login` are redirected to the application root.
5. Server Components and server-side application services use the `auth()` helper and the reusable current-user helpers. Client Components access non-sensitive session display data through `SessionProvider`.
6. Signing out invalidates the Auth.js session cookie and redirects the user to `/login`.

## Authorization Approach

Roles are loaded from the database as part of identity lookup and are carried in the authenticated session for display and route protection. Authentication and current-user helpers require an active, non-deleted user with an active role. The shared authorization helpers provide authentication, role-check, and role-requirement operations for future feature services.

The JWT contains only the user identifier and role alongside Auth.js's standard display identity fields; it does not contain password hashes or complete database records. Auth.js's documented JWT expiry defaults apply because no product-specific session duration has been approved. A role change can remain visible in an existing JWT until the session is refreshed or expires. Sensitive server-side operations must therefore call the current-user or role helpers, which re-read the active user and role from the database; a deleted user or deleted role is rejected immediately at those boundaries.

No permissions are hardcoded. Future feature modules must define and enforce their approved authorization requirements at server-side boundaries before invoking protected work. Client-side role checks are presentation-only and never replace server-side authorization.

## Seed Security

Development seed execution is refused in production. Seed user emails and passwords must be supplied through environment variables; the script rejects missing values, placeholder passwords, known obvious defaults, and passwords shorter than 16 characters. It stores only bcrypt hashes and intentionally updates those hashes when seed credentials change. Seed output never includes credentials.

## Future API Contracts

When non-authentication API boundaries are introduced, they will follow [ARCHITECTURE.md](ARCHITECTURE.md): request validation at the boundary, business orchestration in services, and persistence through repositories. Contracts, authorization requirements, error responses, and versioning decisions must be documented before an API is exposed.

## Reports Endpoints

All Reports endpoints require an active Planner or Administrator session.

- `GET /api/reports` returns bounded immutable report history. Administrators receive sanitized failure details; Planners receive status only.
- `POST /api/reports/daily-orders` creates an immutable Daily Orders snapshot from the normalized server-side report filter contract. It accepts `{ "filters": { ... } }`, excludes client pagination from persisted metadata, and returns an existing equivalent snapshot instead of creating a concurrent duplicate.
- `GET /api/reports/:id/artifacts/:format` is the protected download boundary for completed `XLSX` or `PDF` artifacts. No artifact generator is implemented in Stage B, so it normally returns a safe `404` until a completed artifact exists.

Reports routes use safe error envelopes and do not expose filesystem paths, checksums, database errors, or stack traces. See [REPORTING.md](REPORTING.md) for lifecycle, storage, checksum, and history details.

## Orders Endpoints

The authenticated Orders API provides operational read access and Administrator-only management updates:

- `GET /api/orders` lists non-deleted orders and accepts `query`, `page`, `pageSize`, `sortBy`, and `sortDirection` query parameters. Defaults are page `1`, page size `25`, order-number ascending sort; page size is limited to `100`.
- `GET /api/orders/:id` returns one non-deleted order with its approved customer, delivery, and audit information.
- `PATCH /api/orders/:id` is Administrator-only. It validates approved editable fields server-side. The optional Purchase Order Number is trimmed only at its outer whitespace, remains text, and is unavailable until the additive Order export-fields migration has been applied.

Order list searching is performed server-side across order number, picking number, and customer name. Supported sorting is limited to order number, customer, picking number, and goods issue date. Both endpoints require the current authenticated user helper and return a consistent `data` or `error` response envelope. Invalid query or identifier input returns `400`; a missing order returns `404`; unauthenticated access returns `401`; unexpected failures return generic `500` responses without infrastructure details.

## Orders Service and Repository Boundaries

The Orders repository is the only Orders-layer code that queries Prisma. The Orders service validates request inputs, coordinates repository calls, exposes the established not-found behaviour, and reserves an activity-recorder boundary for future approved mutations. Pages and route handlers do not query Prisma directly.

Zod schemas own order search and approved administration-update validation. The Purchase Order Number is never supplied by the SAP importer and remains optional internal AXon information; Dachser exports use SAP Sales Order Number instead.

## Shipments Endpoints

The authenticated Shipments API provides read-only operational access:

- `GET /api/shipments` returns a paginated shipment list.
- `GET /api/shipments/:id` returns a shipment, its assigned deliveries, and the read-only list of available deliveries for future planning.

Both endpoints require an authenticated, active database user and return `401` when one is not present. The collection endpoint accepts `query`, `page`, `pageSize`, `sortBy`, and `sortDirection`. Search is server-side, case-insensitive, trimmed, and bounded to shipment numbers and carrier names. Pagination defaults to page `1` and page size `25`; page size is limited to `100`. Sorting is allowlisted to shipment number, carrier, dispatch date, delivery date, actual pallets, actual weight, and delivery count; all results use a stable secondary identifier order. Invalid query parameters return `400`.

Successful responses use a `{ data, meta? }` envelope. Detail requests return `404` for a missing non-deleted shipment and `400` for an invalid identifier. Unexpected failures return generic `500` error envelopes without infrastructure details. The shipment detail read model includes shipment notes, approved audit metadata, and delivery read models that expose delivery and order numbers rather than unrelated identity data. Available deliveries are limited to the first `100` active, unassigned deliveries and indicate when more records exist. Shipment status is not persisted in the current schema, so the workspace presents it only as a neutral unavailable value.

The Shipments repository is the only Shipments-layer code that accesses Prisma. The service validates request input, coordinates repository calls, exposes the established not-found behaviour, and reserves an activity-recorder boundary for future approved mutations. Route handlers and pages do not access Prisma directly. The current Shipments scope is read-only: it includes no assignment actions, planning automation, exports, or mutation endpoints. Delivery count is derived from active, non-deleted deliveries with active orders. Total pallets and total weight use shipment-level persisted actual fields only; delivery-level pallet and weight fields do not exist in the current data model.

## Dashboard Endpoint

`GET /api/dashboard` returns the authenticated operational dashboard read model. It includes bounded lists of active Orders scheduled for Goods Issue on the current operational day, newest active shipments, recently recorded activity, and customers with active Rep Issues, plus live counts of active orders, customers, shipments, carriers, and sales representatives. The endpoint requires an authenticated, active database user and returns `401` when one is not present. It returns a `{ data }` envelope on success and a generic `500` error envelope for unexpected failures.

Today’s Orders uses only active, non-deleted orders with a non-null `goodsIssueDate` within the current calendar day in `APP_TIME_ZONE`. `APP_TIME_ZONE` is required server-side configuration, validated before use; the date-only query uses the resulting operational calendar date without browser or server-local timezone conversion. Today’s Orders, Recent Shipments, Recent Activity, and Customers Requiring Attention are each limited to five records. All lists and counts exclude soft-deleted primary operational records, and shipment delivery counts include only active deliveries with active orders.

The dashboard is read-only. It does not calculate KPIs, percentages, analytics, planning recommendations, inferred statuses, or warehouse departure dates. It does not claim automatic real-time refreshes.

## Delivery Assignment Endpoints

`POST /api/shipments/:id/deliveries` assigns an eligible delivery using `{ "deliveryId": "<uuid>" }`. `DELETE /api/shipments/:id/deliveries/:deliveryId` unassigns a delivery from that shipment. Both require an authenticated active user with the Administrator or Planner role. Requests return `{ data }` on success, `400` for invalid IDs or bodies, `401` for unauthenticated access, `403` for an unauthorized role, `404` for unavailable shipments or deliveries, `409` when the requested assignment state changed or the delivery is already assigned, and a safe `500` response for unexpected failures.

Assignment and unassignment use transaction-safe conditional updates. Successful changes create a factual Activity record in the same transaction; failed requests create no activity. These single-delivery endpoints support one delivery at a time only—no drag and drop, shipment creation, or delivery/order editing.

## SAP Delivery Paste Import Endpoints

The authenticated shipment import workflow operates only on an existing active shipment identified by the route ID. It never creates a shipment and does not accept a client-supplied target shipment ID in the request body. Both endpoints require an active database user with the Administrator or Planner role.

- `POST /api/shipments/:id/delivery-import/preview` accepts the strict body `{ "deliveryNumbers": "<pasted content>" }`. The content may use new lines, tabs, spaces, commas, or semicolons as separators. The service trims values, removes empty entries, preserves leading zeroes, rejects UUIDs, records duplicates, and permits at most 200 unique SAP Delivery Numbers. The preview is read-only.
- `POST /api/shipments/:id/delivery-import/commit` accepts the strict body `{ "deliveryNumbers": ["800000001", "800000002"] }`. Values are normalized Delivery Number strings only; the server does not accept delivery UUIDs or trust prior preview state.

Preview results return approved operational fields only: delivery number, order number where available, customer name where available, current shipment number where relevant, classification, and a factual message. Ship-To and route code are not returned because they are not persisted. Primary classifications use this order: `notFound`, `unavailableDelivery`, `unavailableOrder`, `alreadyAssignedToTarget`, `assignedToAnotherShipment`, then `eligible`. Duplicate input is returned separately as input-quality information and never duplicates a primary result. A non-delivery value, such as a pasted column header, is returned as `notFound` with guidance to remove non-delivery text.

Commit uses partial-success semantics. It rechecks active target-shipment, delivery, order, and assignment state in a transaction, conditionally assigns only deliveries that remain active and unassigned, and returns a complete ordered result and summary. The summary reports `requestedCount`, `uniqueCount`, `duplicateInputCount`, `assignedCount`, `alreadyAssignedToTargetCount`, `assignedElsewhereCount`, `notFoundCount`, `unavailableDeliveryCount`, `unavailableOrderCount`, `unavailableCount`, and `skippedCount`. `assignedCount + skippedCount` always equals `uniqueCount`; duplicate input is separate and does not affect that equation. A concurrent or stale assignment is skipped rather than silently reassigned. Every successful assignment creates a factual Activity record in the same transaction; an unexpected database or Activity failure rolls back the transaction. Per-item operational conflicts remain part of a successful `200` response. Invalid requests return `400`, unauthenticated requests `401`, unauthorized roles `403`, unavailable target shipments `404`, and unexpected failures a safe `500` envelope.

The import has no SAP API integration, schedule import, pallet capture, low-weight warning, automatic grouping, or automatic material classification. Gross order weight is not persisted in the current schema, so low-weight guidance is intentionally unavailable.

# Data Management Import Endpoints

All Data Management endpoints require an active Administrator or Planner session.

- `POST /api/data-imports/upload` accepts `multipart/form-data` with `file` and `importType`.
- `GET /api/data-imports` returns recent batch history.
- `GET /api/data-imports/:id` returns safe batch workflow metadata and sheet summaries.
- `POST /api/data-imports/:id/sheet` accepts `{ "sheetName": string }`.
- `POST /api/data-imports/:id/header` accepts `{ "headerRow": number }`.
- `POST /api/data-imports/:id/mapping` accepts import type, selected sheet/header, and an allowlisted mapping.
- `POST /api/data-imports/:id/preview` uses staged server data only.
- `GET /api/data-imports/:id/rows` returns bounded, safe raw-sheet or mapped-preview rows. It accepts `view` (`raw` or `preview`), `page`, `pageSize` (20, 50, or 100), and, for mapped previews, optional `query` and `classification` filters.
- `POST /api/data-imports/:id/commit` accepts no row payload and revalidates server-side.
- `GET /api/data-imports/:id/results` returns bounded safe results; `results.csv` exports formula-safe CSV.

The raw-sheet response excludes header and earlier rows, uses selected header labels only, and returns staged cell values without identifiers or internal records. The mapped-preview response exposes only allowlisted planner-facing display values, classifications, messages, and safe current/proposed values for row inspection. Neither response accepts client-authoritative preview values.

# Reports: Excel generation

`POST /api/reports/:id/artifacts/XLSX` creates an Excel file for a completed Daily Orders report. It requires an authenticated Planner or Administrator and returns safe `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_ARTIFACT`, `REPORT_XLSX_GENERATING`, `REPORT_XLSX_UNAVAILABLE`, or `REPORT_XLSX_GENERATION_FAILED` responses.

`GET /api/reports/:id/artifacts/XLSX` streams a completed checksum-verified private file to an authorised Planner or Administrator. It does not expose storage paths. The workbook is rendered only from the report record’s stored rows, KPIs, exceptions, and filter metadata.

## Carrier Export Endpoints

Carrier Export endpoints require an active Planner or Administrator session. The feature remains unavailable until its additive schema migration is applied; the feature gate prevents new-column reads from affecting existing Orders workflows before then.

- `POST /api/carrier-exports/preview` validates a selected active Carrier, Goods Issue date, and export stage (`INITIAL`, `UPDATE`, or `ADDITION`). It returns immutable-candidate rows, calculated planned pallets, comparison counts, and row-level blockers without writing operational data.
- `POST /api/carrier-exports` persists a pending immutable export snapshot, renders a private XLSX artifact, and completes the run only after private storage succeeds.
- `GET /api/carrier-exports` returns bounded export history.
- `GET /api/carrier-exports/:id/artifact` streams a completed, checksum-verified XLSX file through an authenticated route without disclosing its storage key or filesystem path.
- `POST /api/carrier-exports/:id/sent` is Administrator-only and changes a generated run to `SENT` with an audit activity.

The export reads the business-confirmed SAP gross Order weight for each eligible Order/Delivery row and uses the export-only rule `MAX(1, CEILING(weight / 750 kg))`. It never writes planned export values back to operational Order, Delivery, Shipment, Pallet, Report, or import records.
