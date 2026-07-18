# Product Vision

## 1. Product Overview

Transport Operations Hub is the operational workspace for transport planners. It replaces spreadsheet-based tracking and repetitive SAP navigation with one purpose-built application for managing the daily transport operation.

SAP remains the system of record and ERP. Transport Operations Hub complements SAP: it brings the work planners need to perform each day into a clear, task-oriented workspace. The product dashboard provides an immediate operational view of:

- what is left from yesterday;
- what must be planned today;
- which shipments are waiting; and
- which reports are open.

## 2. Mission

Enable transport planners to run the daily operation with confidence by making priorities, shipment progress, planning activities, and outstanding work clear and actionable.

## 3. Vision

Become the daily starting point and primary operational workspace for transport planning: a dependable place where planners can understand the state of the operation, complete transport work, and manage today’s plan without relying on disconnected Excel files or repetitive ERP navigation.

## 4. Target Users

The primary users are transport planners responsible for monitoring, planning, updating, and completing transport activity throughout the day.

The product is designed around their operational needs: rapid orientation at the start of the day, focused planning around daily cutoffs, accurate transport updates, and reliable handling of exceptions and open reports.

## 5. Daily Workflow

Each working day has two connected operational streams:

1. **Yesterday’s transport** — close out outstanding transport activity, update shipments and deliveries, capture actuals, complete transport records, and handle REP reports.
2. **Today’s planning** — plan the day’s work around the established morning, midday, and afternoon windows; generate the required carrier output; and accommodate late additions.

The dashboard must make the state of both streams visible so that planners can decide what requires attention next.

## 6. Yesterday Workflow

Yesterday’s transport work covers activity that remains open after the prior operating day. The workflow is:

1. Update shipments.
2. Assign deliveries.
3. Record actual pallets.
4. Record weights.
5. Complete transport.
6. Handle REP reports.

This work should be easy to identify, progress, and resolve before it obscures today’s planning priorities.

## 7. Today's Planning Workflow

Today’s planning is structured around the current daily schedule:

| Window    | Planning activity          |
| --------- | -------------------------- |
| Morning   | Plan Woodies and B&Q work. |
| Midday    | Work to the 12:00 cutoff.  |
| Afternoon | Work to the 14:00 cutoff.  |
| Output    | Generate the Dachser CSV.  |
| Ongoing   | Handle late additions.     |

The product should support planners in seeing what belongs in each window, progressing the plan through the cutoffs, producing the Dachser CSV, and managing late additions without losing visibility of the overall plan.

## 8. Order Lifecycle

Transport Operations Hub represents the established order lifecycle as a clear progression:

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

The application should make the current lifecycle stage visible and use it to help planners understand where work is waiting. Detailed transition rules, ownership, and exception handling will be defined separately as requirements are established.

## 9. Design Philosophy

- **Operational clarity first.** Present the most important work, status, and exceptions without requiring planners to assemble the picture from multiple tools.
- **Action-oriented by design.** Make it clear what needs attention and provide a direct path to the relevant work.
- **SAP-aligned, not SAP-replacing.** SAP remains the ERP and system of record; this product improves the planner’s day-to-day operating experience.
- **Trust through accuracy.** Display information and progress clearly so planners can make decisions with confidence.
- **Efficient under daily pressure.** Support fast orientation, focused work, and predictable completion around planning cutoffs.
- **Enterprise quality.** Prioritise reliability, accessibility, consistency, and maintainability over unnecessary complexity.

## 10. Product Principles

### 1. One Screen, One Purpose

Every page should have a single clear responsibility.

| Page      | Purpose             |
| --------- | ------------------- |
| Dashboard | Operations overview |
| Orders    | Process orders      |
| Shipments | Update shipments    |
| Customers | Customer history    |
| Reports   | REP management      |
| Analytics | KPIs                |
| Settings  | Configuration       |

### 2. Operational First

Always prioritise helping planners complete work over displaying information.

### 3. Fast by Default

Frequently used actions should require the fewest possible clicks.

### 4. Search Everywhere

Every operational object should be discoverable through the global search.

### 5. SAP Remains ERP

Transport Operations Hub never replaces SAP. It extends SAP with a modern operational experience.

### 6. Enterprise Quality

Design every feature as if it will be used by multinational logistics teams every day.

## 11. Success Metrics

The product’s success will be measured by evidence that it improves the planner’s daily workflow. Metrics and baselines will be defined as the product evolves; initial areas of measurement are:

- adoption of Transport Operations Hub as the planner’s daily operational workspace;
- reduction in dependency on Excel for daily transport tracking and planning;
- reduction in repetitive SAP navigation required to complete common operational tasks;
- visibility and timely resolution of yesterday’s outstanding work, waiting shipments, and open REP reports;
- completion of planning activity around the established 12:00 and 14:00 cutoffs;
- reliable production of the Dachser CSV; and
- planner confidence in the accuracy and usefulness of the operational dashboard.

## 12. Long-Term Vision

Transport Operations Hub will evolve into the trusted operational layer around SAP for transport planners. Its role is to provide a unified, clear, and efficient daily workspace that grows with established transport processes while preserving SAP as the ERP system of record.

Future capabilities and business rules will be introduced only when they are defined and validated. This document sets the product direction, not detailed operational policy.
