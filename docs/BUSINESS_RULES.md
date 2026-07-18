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
