import { ArrowRight, ClipboardList, FileUp, PackagePlus, Truck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { SectionHeader } from "@/components/shared/operations/section-header";
import type { DashboardData, DashboardOrder } from "@/features/dashboard/types/dashboard";
import { formatSapWeight } from "@/features/data-management/domain/preview";

const todayHref = "/orders?datePreset=today";
const dashboardMetrics = [
  ["Today’s Orders", "todayOrders", todayHref],
  ["Remaining Today", "remaining", `${todayHref}&palletState=awaiting&shipmentState=unassigned`],
  ["Assigned to Shipment", "assigned", `${todayHref}&shipmentState=assigned`],
  ["Awaiting Pallet Data", "awaitingPalletData", `${todayHref}&palletState=awaiting`],
] as const;

function statusLabel(order: DashboardOrder) {
  if (order.status === "awaiting") return "Awaiting pallet data";
  return order.weightStatus === "exact"
    ? "Exact SAP weight"
    : order.weightStatus === "under"
      ? "Under SAP weight"
      : order.weightStatus === "over"
        ? "Over SAP weight"
        : "Captured";
}

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs font-medium">
      {children}
    </span>
  );
}

export function DashboardWorkspace({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-wrap gap-2" aria-label="Planner actions">
        <Button nativeButton={false} render={<Link href="/data-management" />} size="sm">
          <FileUp />
          Import SAP Orders
        </Button>
        <Button
          nativeButton={false}
          render={<Link href={`${todayHref}&palletState=awaiting`} />}
          size="sm"
          variant="outline"
        >
          <ClipboardList />
          View Awaiting Pallets
        </Button>
        <Button
          nativeButton={false}
          render={<Link href={`${todayHref}&shipmentState=unassigned`} />}
          size="sm"
          variant="outline"
        >
          <Truck />
          View Remaining Today
        </Button>
        <Button
          nativeButton={false}
          render={<Link href="/shipments" />}
          size="sm"
          variant="outline"
        >
          <PackagePlus />
          Create Shipment
        </Button>
      </div>
      <section
        aria-label="Today’s operational summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {dashboardMetrics.map(([label, key, href]) => (
          <Link
            className="border-border/80 bg-card hover:bg-muted/30 rounded-xl border p-4 shadow-sm transition-colors"
            href={href}
            key={key}
          >
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="text-foreground mt-2 text-2xl font-semibold">{data.todaySummary[key]}</p>
          </Link>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <OperationsPanel aria-label="Today’s Orders">
          <SectionHeader description="Goods Issue Date: today" title="Today’s Orders" />
          {data.todayOrders.length ? (
            <ul className="divide-border/80 divide-y">
              {data.todayOrders.map((order) => (
                <li className="px-5 py-3.5" key={order.id}>
                  <Link
                    className="text-foreground hover:text-primary flex items-start justify-between gap-3"
                    href={`/orders/${order.id}`}
                  >
                    <span>
                      <span className="font-medium">{order.orderNumber}</span>
                      <span className="text-muted-foreground mt-1 block text-sm">
                        {order.customerName ?? "Customer unavailable"} ·{" "}
                        {order.shipToNumber ?? "Ship-To unavailable"} ·{" "}
                        {order.routeCode ?? "Route unavailable"}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {formatSapWeight(order.grossWeightKg) ?? "Weight unavailable"} · Est.{" "}
                        {order.estimatedPalletCount ?? "—"} pallets ·{" "}
                        {order.actualPalletCount ?? "Awaiting"} actual
                      </span>
                    </span>
                    <span className="flex max-w-32 flex-wrap justify-end gap-1">
                      <StatusBadge>{order.shipmentNumber ? "Assigned" : "Unassigned"}</StatusBadge>
                      <StatusBadge>{statusLabel(order)}</StatusBadge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="No Orders scheduled for today."
              icon={ClipboardList}
              title="No Orders today"
            />
          )}
        </OperationsPanel>
        <OperationsPanel aria-label="Remaining Today">
          <SectionHeader
            action={
              <Button
                nativeButton={false}
                render={
                  <Link href={`${todayHref}&palletState=awaiting&shipmentState=unassigned`} />
                }
                size="xs"
                variant="ghost"
              >
                View all remaining
                <ArrowRight />
              </Button>
            }
            description="Orders needing planner attention"
            title="Remaining Today"
          />
          {data.remainingToday.length ? (
            <ul className="divide-border/80 divide-y">
              {data.remainingToday.map((order) => (
                <li className="px-5 py-3.5" key={order.id}>
                  <Link
                    className="flex items-center justify-between gap-3"
                    href={`/orders/${order.id}`}
                  >
                    <span>
                      <span className="text-foreground font-medium">{order.orderNumber}</span>
                      <span className="text-muted-foreground mt-1 block text-sm">
                        {order.customerName ?? "Customer unavailable"}
                      </span>
                    </span>
                    <span className="text-right">
                      <StatusBadge>{order.reason}</StatusBadge>
                      {order.additionalIssueCount ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          +{order.additionalIssueCount} issue
                          {order.additionalIssueCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="Today’s workload is complete under the currently available operational signals."
              icon={ClipboardList}
              title="No remaining Orders"
            />
          )}
        </OperationsPanel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <OperationsPanel aria-label="Recent Shipments">
          <SectionHeader description="Newest active shipments" title="Recent Shipments" />
          {data.recentShipments.length ? (
            <ul className="divide-border/80 divide-y">
              {data.recentShipments.map((shipment) => (
                <li className="px-5 py-3.5" key={shipment.id}>
                  <Link
                    className="text-primary font-medium hover:underline"
                    href={`/shipments/${shipment.id}`}
                  >
                    {shipment.shipmentNumber}
                  </Link>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {shipment.carrierName ?? "Carrier unavailable"} · {shipment.deliveryCount}{" "}
                    deliveries · {shipment.palletCount} pallets
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState description="No active Shipments yet." icon={Truck} title="No shipments" />
          )}
        </OperationsPanel>
        <OperationsPanel aria-label="Weight checks">
          <SectionHeader description="Captured pallet comparisons" title="Weight checks" />
          <dl className="grid grid-cols-3 gap-3 p-5 text-center">
            <div>
              <dt className="text-muted-foreground text-xs">Exact</dt>
              <dd className="mt-1 text-xl font-semibold">{data.todaySummary.exactWeight}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Under</dt>
              <dd className="mt-1 text-xl font-semibold">{data.todaySummary.underWeight}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Over</dt>
              <dd className="mt-1 text-xl font-semibold">{data.todaySummary.overWeight}</dd>
            </div>
          </dl>
          <p className="text-muted-foreground px-5 pb-5 text-xs">
            Completed Today is unavailable until an approved completion or dispatch state is
            persisted.
          </p>
        </OperationsPanel>
      </div>
    </div>
  );
}
