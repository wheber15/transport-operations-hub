import Link from "next/link";

import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import type {
  DailyOrdersException,
  DailyOrdersKpis,
  DailyOrdersReportRow,
  TrailerPlanning,
} from "@/features/reports/domain/daily-orders-report";

function kg(value: string | null) {
  return value === null
    ? "—"
    : `${Number(value).toLocaleString("en-IE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
}
function number(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-IE");
}

export function DailyOrdersReportPreview({
  rows,
  kpis,
  trailerPlanning,
  exceptions,
}: {
  rows: DailyOrdersReportRow[];
  kpis: DailyOrdersKpis;
  trailerPlanning: TrailerPlanning;
  exceptions: DailyOrdersException[];
}) {
  return (
    <div className="space-y-5">
      <p className="text-muted-foreground border-border/70 bg-muted/30 rounded-lg border px-4 py-3 text-sm">
        SAP weight and estimated pallets are currently recorded at Sales Order level. Orders with
        multiple Deliveries contribute once to report totals.
      </p>
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Daily Orders KPI summary"
      >
        {[
          ["Total Orders", number(kpis.totalOrders)],
          ["Total Deliveries", number(kpis.totalDeliveries)],
          ["SAP Weight", kg(kpis.totalSapWeightKg)],
          ["Actual Weight", kg(kpis.totalActualWeightKg)],
          [
            "Actual Weight Coverage",
            kpis.actualWeightCoveragePercentage === null
              ? "—"
              : `${kpis.actualWeightCoveragePercentage.toFixed(1)}%`,
          ],
          ["Estimated Pallets", number(kpis.estimatedPallets)],
          ["Actual Pallets", number(kpis.actualPallets)],
          ["Awaiting Shipment", number(kpis.awaitingShipment)],
          ["Awaiting Pallet Data", number(kpis.awaitingPalletData)],
          ["Overdue", number(kpis.overdue)],
          ["Shipments Created", number(kpis.shipmentsCreated)],
          ["Remaining Trailer Requirement", number(kpis.remainingTrailerRequirement)],
        ].map(([label, value]) => (
          <div
            className="border-border/70 bg-card rounded-xl border p-4 shadow-sm"
            key={String(label)}
          >
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="text-foreground mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <OperationsPanel aria-label="Trailer planning guidance">
        <div className="border-border/80 border-b px-5 py-4">
          <h2 className="text-base font-semibold">Trailer planning guidance</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Planning guidance only. It does not allocate Deliveries to Shipments.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-sm">Capacity</p>
            <p className="mt-1 font-semibold">{trailerPlanning.capacity} pallets</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Trailers required</p>
            <p className="mt-1 font-semibold">{trailerPlanning.trailersRequired}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Unused capacity</p>
            <p className="mt-1 font-semibold">{trailerPlanning.unusedCapacity} pallets</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Utilisation</p>
            <p className="mt-1 font-semibold">
              {trailerPlanning.capacityUtilisation === null
                ? "—"
                : `${trailerPlanning.capacityUtilisation.toFixed(1)}%`}
            </p>
          </div>
        </div>
        {trailerPlanning.breakdown.length ? (
          <ol className="border-border/80 grid gap-2 border-t px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            {trailerPlanning.breakdown.map((pallets, index) => (
              <li className="text-sm" key={index}>
                Trailer {index + 1}: <span className="font-medium">{pallets} pallets</span>
              </li>
            ))}
          </ol>
        ) : null}
      </OperationsPanel>
      <OperationsPanel aria-label="Items Requiring Attention">
        <div className="border-border/80 border-b px-5 py-4">
          <h2 className="text-base font-semibold">Items Requiring Attention</h2>
        </div>
        {exceptions.length ? (
          <div className="max-h-[30rem] overflow-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="text-muted-foreground bg-muted/80 sticky top-0 z-10 text-xs uppercase">
                <tr>
                  {[
                    "Severity",
                    "Category",
                    "Delivery Number",
                    "Sales Order",
                    "Customer",
                    "Details",
                    "Suggested Action",
                  ].map((heading) => (
                    <th className="px-4 py-3 font-medium" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border/80 divide-y">
                {exceptions.slice(0, 20).map((item, index) => (
                  <tr className="align-top" key={`${item.deliveryId}-${item.category}-${index}`}>
                    <td className="px-4 py-3">
                      <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                        {item.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{item.category}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="text-primary underline-offset-4 hover:underline"
                        href={`/orders/${item.orderId}#delivery-${item.deliveryId}`}
                      >
                        {item.deliveryNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{item.orderNumber}</td>
                    <td className="px-4 py-3">{item.customerName ?? "—"}</td>
                    <td className="text-muted-foreground max-w-md px-4 py-3 whitespace-normal">
                      {item.explanation}
                    </td>
                    <td className="text-muted-foreground max-w-md px-4 py-3 whitespace-normal">
                      {item.suggestedAction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground px-5 py-8 text-sm">
            No report exceptions match the selected scope.
          </p>
        )}
      </OperationsPanel>
      <OperationsPanel aria-label="Daily Orders details">
        <div className="border-border/80 border-b px-5 py-4">
          <h2 className="text-base font-semibold">Daily Orders</h2>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-muted-foreground bg-muted/30 text-xs uppercase">
                <tr>
                  {[
                    "Delivery",
                    "Sales Order",
                    "Customer",
                    "Ship-To",
                    "Route",
                    "Goods Issue",
                    "Order SAP Weight",
                    "Actual Weight",
                    "Order Est. Pallets",
                    "Actual Pallets",
                    "Shipment",
                    "Carrier",
                    "Status",
                  ].map((head) => (
                    <th className="px-4 py-3 font-medium" key={head}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border/80 divide-y">
                {rows.map((row) => (
                  <tr key={row.deliveryId}>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        className="text-primary hover:underline"
                        href={`/orders/${row.orderId}#delivery-${row.deliveryId}`}
                      >
                        {row.deliveryNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.orderNumber}</td>
                    <td className="px-4 py-3">{row.customerName ?? "—"}</td>
                    <td className="px-4 py-3">{row.shipToNumber ?? "—"}</td>
                    <td className="px-4 py-3">{row.routeCode ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.goodsIssueDate?.toISOString().slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-3">{kg(row.orderSapWeightKg)}</td>
                    <td className="px-4 py-3">{kg(row.actualWeightKg)}</td>
                    <td className="px-4 py-3">{number(row.orderEstimatedPallets)}</td>
                    <td className="px-4 py-3">{number(row.actualPallets)}</td>
                    <td className="px-4 py-3">{row.shipmentNumber ?? "Awaiting"}</td>
                    <td className="px-4 py-3">{row.carrierName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.palletStatus === "captured"
                        ? "Pallet data captured"
                        : "Awaiting pallet data"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground px-5 py-8 text-sm">
            No active Deliveries match the selected report scope.
          </p>
        )}
      </OperationsPanel>
    </div>
  );
}
