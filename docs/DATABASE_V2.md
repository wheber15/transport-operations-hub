# Production Database Blueprint

## 1. Purpose

This document defines the production physical business data model for Transport Operations Hub. It is the blueprint from which Prisma models, database constraints, indexes, and migrations will later be implemented.

It replaces the logical model as the authoritative database-design reference when physical design decisions are required. It does not contain Prisma models, SQL, migrations, or implementation code.

## 2. Database Standards

| Standard           | Decision                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary keys       | Use UUID primary keys for business entities.                                                                                                                                                      |
| Table names        | Use singular table names.                                                                                                                                                                         |
| Prisma model names | Use PascalCase model names.                                                                                                                                                                       |
| Fields             | Use camelCase field names.                                                                                                                                                                        |
| Timestamps         | Store timestamps in UTC.                                                                                                                                                                          |
| Soft deletion      | Preserve business records with a nullable deletion timestamp rather than physically deleting them.                                                                                                |
| Audit fields       | Use the shared audit fields on every business entity.                                                                                                                                             |
| Foreign keys       | Name foreign-key fields as the related model name followed by `Id`, for example `customerId`.                                                                                                     |
| Indexes            | Index primary keys, foreign keys, identifiers used for operational lookup, and fields used by approved search or filtering requirements.                                                          |
| Unique constraints | Apply unique constraints only to identifiers or relationship combinations that must be unique by established business requirements.                                                               |
| Nullable fields    | A field is nullable only when the business value is genuinely unknown, not yet available, or not applicable. Required business facts must not be represented by empty strings or sentinel values. |

Indexes and constraints must be added deliberately with the model they protect. They must support integrity and established operational access patterns without duplicating data or adding speculative indexes.

### Tenant Readiness

The current release is single-tenant. A `Tenant` entity is not implemented at this stage. Entity primary keys and business identifiers must remain stable so that tenant ownership can be introduced later without replacing existing operational identifiers.

### ERP Integration and Business Identifiers

SAP remains the system of record. AXon stores operational copies of SAP-derived data for daily transport work.

Every model uses an internal UUID primary key. Operational records also retain the applicable user-facing SAP or business identifier, including `orderNumber`, `deliveryNumber`, `shipmentNumber`, `pickingNumber`, and `goodsIssueDate`. Internal UUIDs are never displayed to users as operational identifiers.

### Enum Strategy

Use Prisma enums only when the application controls an approved, complete set of allowed values. Do not create status or classification values before they are defined by business rules. When an approved value set is not yet defined, use the least speculative field representation and document the decision with the model implementation.

## 3. Shared Columns

Every business entity should contain the following standard columns:

| Column      | Purpose                                                       |
| ----------- | ------------------------------------------------------------- |
| `id`        | UUID primary key that provides a stable record identity.      |
| `createdAt` | UTC timestamp for when the record was created.                |
| `updatedAt` | UTC timestamp for the most recent record update.              |
| `createdBy` | Reference to the user responsible for creating the record.    |
| `updatedBy` | Reference to the user responsible for the most recent update. |
| `deletedAt` | Nullable UTC timestamp used to record soft deletion.          |

These columns provide consistent identity, traceability, and historical preservation across the operational model. Any exception must be documented before implementation.

## 4. Core Entities

| Entity       | Responsibility                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| User         | Represents an application user who interacts with business records and is referenced by audit and operational activity.                      |
| Role         | Represents an application role used to organise user access responsibilities. The role and permission design is defined separately.          |
| Customer     | Represents a customer associated with orders, deliveries, shipments, and customer history.                                                   |
| SalesRep     | Represents the sales representative associated with customers and related operational issues.                                                |
| Order        | Represents operational work that progresses through the established order lifecycle.                                                         |
| Delivery     | Represents delivery activity belonging to an order and grouped into a shipment.                                                              |
| Pallet       | Represents a warehouse-confirmed pallet associated with a delivery and its actual measured weight.                                           |
| Shipment     | Represents the transport record that groups deliveries, is associated with a carrier, and records shipment-specific operational information. |
| Carrier      | Represents the carrier associated with a shipment.                                                                                           |
| RepIssue     | Represents an outstanding sales representative issue associated with a sales representative and customer.                                    |
| Activity     | Represents an auditable operational activity associated with a user.                                                                         |
| Notification | Represents a notification associated with a user.                                                                                            |
| Attachment   | Represents an attachment associated with supported business records.                                                                         |
| AppSetting   | Represents application configuration managed as a shared application concern.                                                                |

This section establishes entity responsibilities only. Individual columns beyond the shared columns, entity ownership mechanics, and implementation-specific relation definitions will be specified when the corresponding model is designed.

### Pallet Physical Design

A Pallet belongs to exactly one Delivery. It does not store a redundant Order or Shipment reference; shipment ownership is derived through its Delivery. The model records an `id`, `deliveryId`, delivery-scoped `sequenceNumber`, and `actualWeight` alongside the shared audit and soft-delete columns.

`actualWeight` is an individual warehouse-confirmed physical value in kilograms, stored as `Decimal(12,3)`. It is not a SAP order gross weight or a formatted string. Future application validation must reject zero and negative values; Prisma schema syntax does not enforce that rule.

The pair `deliveryId` and `sequenceNumber` is unique. Sequence numbers are positive at the application layer, are not globally unique, and provide deterministic ordering within a delivery. The delivery foreign key uses `Restrict`, preserving the association and preventing destructive deletion of a delivery that still has physical pallet history.

### Activity Structure

Activity records must support entity type, entity ID, action, description, actor, timestamp, and optional structured metadata. Activity provides historical traceability without defining new operational workflows.

### Attachment Scope

Attachments must be able to relate to supported operational records. Their relationship design must not introduce a document-management workflow or unsupported document lifecycle.

## 5. Relationships

The core business relationships are:

```text
Customer
  ├─ Orders
  │   └─ Deliveries
  │       └─ Shipment
  └─ SalesRep

Shipment
  └─ Carrier

User
  ├─ Activity
  └─ Notifications

RepIssue
  ├─ SalesRep
  └─ Customer
```

Additional relationship rules:

- A delivery belongs to an order.
- A delivery has many pallets; each pallet belongs to exactly one delivery. Pallet records remain independent of estimated-pallet calculations and have no direct shipment relationship.
- A shipment groups deliveries.
- A customer is associated with orders and a sales representative.
- A shipment is associated with a carrier.
- A rep issue is associated with both a sales representative and a customer.
- Activity and notifications are associated with users.
- Audit references link business entities to the users who created and last updated them.

Cardinality, cascade behaviour, and physical relation implementation must be specified with the relevant Prisma model and must preserve the data-integrity principles in this document.

## 6. Lookup Data

Lookup or reference tables provide controlled, reusable classifications rather than duplicated free-text values. Initial examples include:

- Carrier Types
- Shipment Status
- Order Status
- Notification Type
- Rep Issue Status

The allowed values for each lookup are not defined in this document. They must be established by approved business rules before implementation. Lookup data does not replace lifecycle or workflow definitions.

## 7. Audit Strategy

Auditability is a requirement of the operational data model.

- `createdBy` and `updatedBy` identify the responsible user for record creation and the latest update.
- `createdAt` and `updatedAt` establish the time-based record history in UTC.
- Activity records provide a separate, traceable log of operational activity associated with users.
- Business records are not physically deleted. Soft deletion and historical records preserve operational traceability and reporting context.

Audit data must remain available with the relevant historical business record. It must not be overwritten by derived analytics or reporting outputs.

## 8. Search Strategy

Global Search is a cross-cutting capability over operational data. Its searchable scope includes:

- Orders
- Deliveries
- Shipments
- Customers
- Sales Representatives
- Goods Issue Dates
- Dispatch Dates
- Picking Numbers
- Shipment Numbers

The physical model must support efficient search across these approved identifiers, dates, and entities. The search indexing technology and query implementation are separate architectural concerns.

## 9. Analytics Strategy

Analytics are calculated from operational data. The data model must preserve the authoritative operational records needed to calculate analytics without creating unnecessary duplicate totals.

Derived values, including shipment totals, customer statistics, and analytics KPIs, should be calculated whenever practical. Actual delivery pallet counts and weights derive from active Pallet records after warehouse confirmation. Shipment counts and weights derive from the pallet records of assigned deliveries. Existing shipment-level actual-pallet and actual-weight fields are manual or legacy snapshots; they must not be combined with pallet-derived totals. Their long-term retention, migration, or reconciliation policy requires a separately approved design.

## 10. AI Readiness

The design reserves space for future AI capabilities without defining their implementation. Potential future entities include:

- AiConversation
- AiMessage
- AiPrompt
- AiSummary

Their data ownership, retention, relationships, and access rules will be defined only when approved AI requirements exist.

## 11. Future Expansion

The physical design must allow future expansion without prematurely adding entities or fields. Reserved areas include:

- Warehouse
- Vehicle
- Route
- Driver
- Invoice
- Document Library
- Calendar
- Workflow Automation

Each future area requires its own approved business rules and physical-model design before it is implemented.

## 12. Design Principles

- **Normalization first.** Model each business fact once and use relationships to connect it to the rest of the system.
- **Avoid duplicated data.** Do not copy values between entities when an authoritative relationship or derivation is available.
- **Prefer relationships over copied values.** Reference related entities rather than storing repeated descriptions or identifiers without a documented reason.
- **Every entity has one owner.** The owning feature or shared concern is responsible for its lifecycle and business behaviour.
- **Operational data is immutable where appropriate.** Preserve historical facts and do not overwrite information that must remain traceable.
- **Historical information is preserved.** Use audit fields and soft deletion to keep the operational record understandable over time.

This document is the blueprint for future Prisma models. Implementation must follow the approved data design and must not introduce business rules or physical structures that are not documented here.
