# AXon Roadmap

This roadmap records approved project phases without assigning dates. Future scope is added only after approval.

## Completed Foundation

1. Product and architecture foundation
   - Product vision, architecture, business rules, and data-model documentation are established.
2. Application foundation
   - The shared application shell and empty-state operations dashboard are in place.
3. Database foundation
   - The initial Prisma schema, PostgreSQL migration history, and development-safe database client are in place.
4. Read-only operational workspaces
   - Authentication, Orders, Shipments, and the live operational dashboard are implemented as approved read-only foundations.
5. Delivery assignment planning
   - Controlled assignment and unassignment of eligible deliveries is implemented for approved operational roles.
6. SAP Delivery paste import
   - Planners can preview and partially assign eligible SAP Delivery Numbers to an existing shipment with current-state revalidation and factual activity records.
7. Pallet data foundation
   - The Pallet schema and migration establish delivery-owned, warehouse-confirmed actual pallet weights. Pallet capture UI and APIs are not yet implemented.

## Current Phase

Pallet capture UI and APIs remain future work. SAP gross-weight parsing and customer-specific schedule imports remain future work. The data foundation must preserve SAP order identifiers, Ship-To identifiers, route codes, gross order weight, and the distinction between SAP Goods Issue dates and any future customer operational schedule. Reconciliation of existing manual or legacy shipment totals with pallet-derived totals remains unresolved. Automatic low-weight handling, automatic free-material classification, and automatic pallet grouping remain out of scope until separately approved.

Daily Orders reporting is implemented. Daily Shipments, Trailer Planning, Pallet Summary, Planned vs Actual Weight, Pallet Accuracy, Carrier Performance, Weekly Operations, Monthly Operations, and KPI Summary remain separate future reporting slices; their calculations and data contracts have not been approved or implemented.

## Future Planning

Spreadsheet import and data-management foundations are implemented. Direct SAP integration, automatic synchronization, automatic cleanup scheduling, manual data editing, and pallet capture remain future work.

Sprint 12.1 enhances the committed import workspace with read-only spreadsheet-style source inspection, a mapped operational preview, server-side pagination and filters, and planner-readable row classifications. It does not expand import types or mutation behavior.

Future phases will be documented here after their product scope, architecture impact, and delivery priorities are approved.
