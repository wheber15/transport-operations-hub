import {
  Activity,
  Building2,
  ClipboardList,
  PackageCheck,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";

import { DashboardGrid } from "@/components/shared/operations/dashboard-grid";
import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { SectionHeader } from "@/components/shared/operations/section-header";
import type { DashboardData } from "@/features/dashboard/types/dashboard";
import { formatDateOnly, formatTimestamp } from "@/lib/date-formatting";

type DashboardWorkspaceProps = {
  data: DashboardData;
};

const summaryItems = [
  { key: "orders", label: "Orders", icon: ClipboardList },
  { key: "customers", label: "Customers", icon: Users },
  { key: "shipments", label: "Shipments", icon: Truck },
  { key: "carriers", label: "Carriers", icon: PackageCheck },
  { key: "salesReps", label: "Sales Representatives", icon: UserRound },
] as const;

export function DashboardWorkspace({ data }: DashboardWorkspaceProps) {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <section aria-label="Operational summary">
        <SectionHeader
          className="border-0 px-0 pt-0"
          description="Counts of active, non-deleted records"
          title="Operational Summary"
        />
        <DashboardGrid className="mt-4" columns="four">
          {summaryItems.map(({ icon: Icon, key, label }) => (
            <article className="border-border/80 bg-card rounded-xl border p-5 shadow-sm" key={key}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">{label}</p>
                  <p className="text-foreground mt-3 text-2xl font-semibold tracking-tight">
                    {data.summary[key]}
                  </p>
                </div>
                <span className="border-border/80 bg-muted/40 text-muted-foreground flex size-9 items-center justify-center rounded-lg border">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
              </div>
            </article>
          ))}
        </DashboardGrid>
      </section>

      <DashboardGrid>
        <OperationsPanel aria-label="Today's Orders">
          <SectionHeader
            description="Orders scheduled for Goods Issue today"
            title="Today's Orders"
          />
          {data.todaysOrders.length > 0 ? (
            <ul className="divide-border/80 divide-y">
              {data.todaysOrders.map((order) => (
                <li className="px-5 py-4" key={order.orderNumber}>
                  <p className="text-foreground text-sm font-medium">{order.orderNumber}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {order.customerName ?? "Customer unavailable"} ·{" "}
                    {order.salesRepName ?? "Sales Rep unavailable"}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Goods issue: {formatDateOnly(order.goodsIssueDate)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="There are no Orders scheduled for Goods Issue today."
              icon={ClipboardList}
              title="No Orders scheduled for today"
            />
          )}
        </OperationsPanel>

        <OperationsPanel aria-label="Recent Shipments">
          <SectionHeader description="Newest active shipments" title="Recent Shipments" />
          {data.recentShipments.length > 0 ? (
            <ul className="divide-border/80 divide-y">
              {data.recentShipments.map((shipment) => (
                <li className="px-5 py-4" key={shipment.shipmentNumber}>
                  <Link
                    aria-label={`Open shipment ${shipment.shipmentNumber}`}
                    className="text-primary focus-visible:ring-ring/50 rounded-sm text-sm font-medium hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
                    href={`/shipments/${shipment.id}`}
                  >
                    {shipment.shipmentNumber}
                  </Link>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {shipment.carrierName ?? "Carrier unavailable"} · Dispatch:{" "}
                    {formatDateOnly(shipment.dispatchDate)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {shipment.deliveryCount}{" "}
                    {shipment.deliveryCount === 1 ? "delivery" : "deliveries"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="Active shipments will appear here when they are available."
              icon={Truck}
              title="No shipments available"
            />
          )}
        </OperationsPanel>
      </DashboardGrid>

      <DashboardGrid>
        <OperationsPanel aria-label="Customers Requiring Attention">
          <SectionHeader
            description="Customers with active Rep Issues"
            title="Customers Requiring Attention"
          />
          {data.customersRequiringAttention.length > 0 ? (
            <ul className="divide-border/80 divide-y">
              {data.customersRequiringAttention.map((customer) => (
                <li className="px-5 py-4" key={customer.customerName}>
                  <p className="text-foreground text-sm font-medium">{customer.customerName}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {customer.salesRepName ?? "Sales Rep unavailable"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="Customers with active Rep Issues will appear here."
              icon={Building2}
              title="No customers require attention"
            />
          )}
        </OperationsPanel>

        <OperationsPanel aria-label="Recent Activity">
          <SectionHeader
            description="Latest recorded operational activity"
            title="Recent Activity"
          />
          {data.recentActivity.length > 0 ? (
            <ul className="divide-border/80 divide-y">
              {data.recentActivity.map((activity) => (
                <li
                  className="px-5 py-4"
                  key={`${activity.occurredAt.toISOString()}-${activity.action}`}
                >
                  <p className="text-foreground text-sm font-medium">{activity.description}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {activity.action} · {activity.actorName ?? "User unavailable"}
                  </p>
                  <time
                    className="text-muted-foreground mt-1 block text-sm"
                    dateTime={activity.occurredAt.toISOString()}
                  >
                    {formatTimestamp(activity.occurredAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="Activity will appear here when it is recorded."
              icon={Activity}
              title="No activity recorded"
            />
          )}
        </OperationsPanel>
      </DashboardGrid>
    </div>
  );
}
