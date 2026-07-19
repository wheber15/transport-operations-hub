# Business Rules

## 1. Purpose

This document defines the business rules, operational workflows, and terminology used throughout Transport Operations Hub. It is the authoritative reference for product behaviour and describes how the transport operation works.

This document does not define technical architecture, database schema, API design, UI implementation, React components, or Prisma models. Those concerns belong in their respective technical documents.

## 2. Core Business Objects

The transport operation is organised around the following business objects:

| Object                     | Purpose                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Customer                   | The customer associated with transport activity, orders, deliveries, and shipment history.          |
| Sales Representative (Rep) | The sales representative associated with the customer and related operational work.                 |
| Order                      | The starting point for work that progresses through the operational lifecycle.                      |
| Delivery                   | A delivery created from an order and assigned to a shipment for transport.                          |
| Shipment                   | The transport record that groups one or more deliveries and captures transport details and actuals. |

The business relationship is:

```text
Customer
  ↓
Sales Representative
  ↓
Orders
  ↓
Deliveries
  ↓
Shipments
```

## 3. Order Lifecycle

Orders progress through the following operational lifecycle:

```text
Planning
  ↓
Picking
  ↓
Shipment Created
  ↓
Dispatch
  ↓
Delivery
  ↓
History
```

| Stage            | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| Planning         | The order is considered for transport planning.                |
| Picking          | The order is in the picking stage.                             |
| Shipment Created | A shipment has been created for the order’s delivery activity. |
| Dispatch         | The shipment is dispatched for transport.                      |
| Delivery         | The delivery stage represents the transport outcome.           |
| History          | Completed lifecycle activity is retained as history.           |

## 4. Daily Operational Cycle

Every working day consists of two simultaneous workflows. Planners constantly switch between them throughout the day as operational priorities require.

### Workflow A: Yesterday's Transport

**Purpose:** Complete outstanding transport work from the previous day.

Tasks:

- Update shipments.
- Assign deliveries.
- Record actual pallets.
- Record actual shipment weight.
- Complete transport records.
- Resolve outstanding Sales Representative (Rep) issues.

### Workflow B: Today's Planning

| Timing          | Activity                        |
| --------------- | ------------------------------- |
| Morning         | Process Woodies.                |
| Morning         | Process B&Q.                    |
| Midday          | Process the 12:00 sales cutoff. |
| Afternoon       | Process the 14:00 final cutoff. |
| End of planning | Generate the Dachser CSV.       |
| End of planning | Handle late additions.          |

### Goods Issue Date and Warehouse Processing

`goodsIssueDate` determines the operational calendar day on which an order enters the warehouse processing workload.

- Monday through Thursday, orders processed on their Goods Issue date normally leave the warehouse on the following day.
- Friday, orders processed on their Goods Issue date normally leave the warehouse on Monday.

The dashboard uses `goodsIssueDate` to identify today’s workload. It does not calculate, display, or otherwise implement the warehouse departure rule at this stage.

## 5. Shipment Rules

A shipment may contain one or more deliveries.

### Pallet Data Foundation

Warehouse-confirmed physical pallets belong to one delivery and record an individual actual weight in kilograms. Actual delivery pallet counts and weights derive from active pallet records; shipment totals derive through assigned deliveries. SAP order gross weight is distinct and must not be distributed, inferred, or reconciled with pallet values automatically.

Pallet data does not turn planning estimates, low-weight guidance, or colour-card and free-material guidance into automatic pallet-generation or classification rules. Manual and legacy shipment totals must not be combined with pallet-derived totals until a reconciliation policy is approved.

A delivery may be assigned only when the delivery and its order are active, the target shipment is active, and the delivery is currently unassigned. A delivery may be unassigned only when the delivery and its order are active and it is assigned to the specified shipment. A delivery is never silently moved between shipments. A stale, already-assigned, already-unassigned, or wrong-shipment request is rejected as a conflict.

Each shipment stores the following operational information:

- Shipment Number
- Dispatch Date
- Delivery Date
- Carrier
- Deliveries
- Customers
- Estimated Pallets
- Actual Pallets
- Actual Weight
- Notes

### SAP Delivery Paste Import

A planner may paste SAP Delivery Numbers into an existing active shipment to bulk-assign eligible deliveries. Numbers may be separated by lines, tabs, spaces, commas, or semicolons. AXon preserves the normalized identifier string, removes empty values, records duplicate input, and accepts no more than 200 unique Delivery Numbers in one request.

The preview is advisory and does not change data. It classifies each unique input as eligible, already assigned to the target shipment, assigned to another shipment, not found, unavailable delivery, or unavailable order. Duplicate input is reported separately so the planner can correct the source paste without obscuring the delivery's primary operational state.

On confirmation, AXon revalidates the target shipment and each delivery against the current database state. It assigns every delivery still eligible and reports skipped values individually. A delivery is never silently moved from another shipment. Concurrent or stale changes are skipped safely; an unexpected failure rolls back the import transaction and its related activity records.

Low-weight guidance is unavailable until SAP gross order weight is persisted. The import must not infer weight, group orders, classify free material, or create pallets.
## 6. Estimated Pallets

Estimated pallets are planning values only. Actual pallets are entered later after loading.

The planning-pallet rule is:

```text
750 kg = 1 planning pallet
```

Always round up to the next planning pallet.

| Weight | Estimated pallets |
| ------ | ----------------- |
| 749 kg | 1                 |
| 750 kg | 1                 |
| 751 kg | 2                 |

## 7. Dashboard Rules

The Dashboard is an Operations Centre. It answers operational questions only and displays:

- Yesterday's Shipments
- Today's Planning
- Today's Progress
- Outstanding Rep Items
- Late Additions
- Recent Activity
- Global Search

The Dashboard must not include historical analytics. Historical analysis belongs in the Analytics module.

## 8. Search Rules

Global Search is available everywhere and must search:

- Order Number
- Delivery Number
- Shipment Number
- Customer
- Sales Representative
- Picking Number
- Goods Issue Date
- Dispatch Date

The keyboard shortcut for Global Search is `Ctrl + K`. Search should return results instantly.

## 9. Customer Rules

Each customer page displays:

- Customer information
- Sales Representative
- Order History
- Shipment History
- Estimated Pallets
- Actual Pallets
- Total Weight
- Monthly Statistics

## 10. Analytics Rules

Analytics is historical. The Dashboard is operational. These responsibilities must never be mixed.

## 11. AI Assistant Rules

The AI Assistant is an Operations Assistant for transport planners. It is not a general-purpose chatbot.

It can:

- Draft professional emails.
- Explain operational issues.
- Search application data.
- Summarise notes.
- Produce management summaries.
- Assist with planning.
- Help solve operational problems.

## 12. General Principles

- Business behaviour is defined in this document.
- Technical implementation belongs in the relevant technical documentation.
- Every future business rule must be documented here before implementation.
- This document is the source of truth for operational behaviour.

## 16. Spreadsheet Import Rules

Spreadsheet imports are owned by authorized Administrators and Planners and are preview-first. Identifiers remain strings with leading zeroes preserved. Imports never silently create operational records, reassign shipments, or overwrite populated values from empty cells. SAP Goods Issue Dates and delivery-owned operational schedules are separate facts. Preview is advisory; commit revalidates state, rejects duplicate business keys, and applies only approved allowlisted fields.
