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

## Current Phase

Actual pallet capture is the next approved foundation scope. The data foundation must preserve SAP order identifiers, Ship-To identifiers, route codes, gross order weight, and the distinction between SAP Goods Issue dates and any future customer operational schedule. Customer-specific schedule imports, automatic low-weight handling, automatic free-material classification, and automatic pallet grouping remain out of scope until separately approved.

## Future Planning

Future phases will be documented here after their product scope, architecture impact, and delivery priorities are approved.
