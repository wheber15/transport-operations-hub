# API Architecture

Application API contracts beyond authentication have not yet been implemented.

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

## Orders Endpoints

The authenticated Orders API provides read-only operational access:

- `GET /api/orders` lists non-deleted orders and accepts `query`, `page`, `pageSize`, `sortBy`, and `sortDirection` query parameters. Defaults are page `1`, page size `25`, order-number ascending sort; page size is limited to `100`.
- `GET /api/orders/:id` returns one non-deleted order with its approved customer, delivery, and audit information.

Order list searching is performed server-side across order number, picking number, and customer name. Supported sorting is limited to order number, customer, picking number, and goods issue date. Both endpoints require the current authenticated user helper and return a consistent `data` or `error` response envelope. Invalid query or identifier input returns `400`; a missing order returns `404`; unauthenticated access returns `401`; unexpected failures return generic `500` responses without infrastructure details.

## Orders Service and Repository Boundaries

The Orders repository is the only Orders-layer code that queries Prisma. The Orders service validates request inputs, coordinates repository calls, exposes the established not-found behaviour, and reserves an activity-recorder boundary for future approved mutations. Pages and route handlers do not query Prisma directly.

Zod schemas own order search, create, and update input validation. Create and update schemas cover only the already-approved order fields; mutation endpoints are not exposed until their business rules are approved. The current Orders scope is read-only.

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

Assignment and unassignment use transaction-safe conditional updates. Successful changes create a factual Activity record in the same transaction; failed requests create no activity. The current scope supports one delivery at a time only—no bulk actions, drag and drop, shipment creation, or delivery/order editing.
