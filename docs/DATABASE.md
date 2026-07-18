# Logical Data Model

## 1. Purpose

This document defines the logical data model for Transport Operations Hub. It describes the business entities, their relationships, ownership, and data design decisions that support the transport operation.

It is implementation-independent. The Prisma schema will be implemented from this document later. This document does not define a physical database, database columns, SQL, or Prisma models.

## 2. Core Business Entities

| Entity               | Purpose                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Customer             | Represents a customer associated with orders, deliveries, shipments, and historical activity.                 |
| Sales Representative | Represents the sales representative associated with a customer and related operational activity.              |
| Order                | Represents an item of operational work that progresses through planning and into delivery activity.           |
| Delivery             | Represents delivery activity belonging to an order and grouped into a shipment for transport.                 |
| Shipment             | Represents the transport record that groups deliveries and carries shipment-specific operational information. |
| User                 | Represents an application user responsible for interacting with the system and its business records.          |
| Carrier              | Represents the carrier associated with a shipment.                                                            |
| Note                 | Represents a recorded note associated with a shipment.                                                        |

## 3. Entity Relationships

The logical relationships are:

```text
Customer
  ↓
Sales Representative

Customer
  ↓
Orders
  ↓
Deliveries

Shipment
  ↓
Deliveries

Shipment
  ↓
Carrier

Shipment
  ↓
Notes
```

In business terms, a customer is associated with a Sales Representative and with orders. Orders lead to deliveries. Shipments group deliveries, are associated with a carrier, and retain shipment notes. The precise cardinality and physical representation of these relationships are implementation decisions to be defined when the data model is implemented.

## 4. Entity Ownership

Entity ownership follows the feature responsible for its business behaviour:

| Entity               | Owning feature or concern           |
| -------------------- | ----------------------------------- |
| Customer             | Customers feature                   |
| Sales Representative | Customers feature                   |
| Order                | Orders feature                      |
| Delivery             | Orders feature                      |
| Shipment             | Shipments feature                   |
| Carrier              | Shipments feature                   |
| Note                 | Shipments feature                   |
| User                 | Shared application identity concern |

Feature ownership defines where the business rules and lifecycle of an entity are maintained. A feature may reference another entity, but it must not take ownership of that entity’s business behaviour.

## 5. Derived Data

Some values should be calculated rather than permanently stored whenever practical. Derived data keeps the model focused on authoritative business records and reduces the risk of inconsistent totals.

Examples include:

- Estimated Pallets
- Shipment Totals
- Customer Statistics
- Analytics KPIs

The calculation method and any required historical snapshot behaviour must be defined by an applicable business rule before implementation.

## 6. Search Strategy

Global Search is a cross-cutting feature. It must make the following business information searchable:

- Orders
- Deliveries
- Shipments
- Customers
- Sales Representatives
- Picking Numbers
- Goods Issue Dates
- Dispatch Dates

Search spans feature boundaries so that a user can find operational objects from one shared search capability. Search indexing and implementation mechanisms are outside the scope of this document.

## 7. Audit Information

Every business entity should support audit information:

- Created At
- Updated At
- Created By
- Updated By

Audit information provides traceability by recording when a business record was created or changed and which user performed the relevant action. It supports operational accountability and historical understanding without changing the business record itself.

## 8. Soft Delete Strategy

Business records should generally remain available for historical reporting. Prefer status changes over physical deletion.

This preserves operational traceability, protects historical information, and avoids breaking the relationship between records that have already participated in the transport operation. Any exception to this principle must be supported by an explicit business rule.

## 9. Data Integrity Principles

The logical model follows these integrity principles:

- Orders should not exist without Customers.
- Deliveries belong to Orders.
- Shipments group Deliveries.
- Historical information should remain traceable.
- Avoid orphaned business records.

The physical enforcement of these principles is an implementation concern. The principles themselves are requirements of the business data model.

## 10. Future Expansion

The logical model must leave room for future business entities without defining them today. Potential future entities include:

- Vehicles
- Warehouses
- Routes
- Invoices
- Documents
- Attachments
- Notifications

These entities, their ownership, relationships, and rules will be documented only when their business requirements are established.
