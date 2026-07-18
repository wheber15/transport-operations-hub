import { Activity, ChevronLeft, ClipboardList, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { Button } from "@/components/ui/button";
import { OrderNotFoundError, getOrderById } from "@/features/orders/application/order-service";
import { formatAuditTimestamp, formatBusinessDate } from "@/features/orders/domain/date-formatting";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  let order;

  try {
    order = await getOrderById(id);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
      <header className="flex flex-col gap-4">
        <Button
          className="w-fit"
          nativeButton={false}
          render={<Link href="/orders" />}
          size="sm"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
          Orders
        </Button>
        <div>
          <p className="text-primary text-sm font-medium">Order</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {order.orderNumber}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {order.customerName ?? "Customer unavailable"}
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-6">
          <OperationsPanel aria-label="Order information">
            <dl className="divide-border/80 divide-y">
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Customer</dt>
                <dd className="text-foreground text-sm font-medium">
                  {order.customerName ?? "Not available"}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Sales Representative</dt>
                <dd className="text-foreground text-sm font-medium">
                  {order.salesRepName ?? "Not available"}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Picking Number</dt>
                <dd className="text-foreground text-sm font-medium">
                  {order.pickingNumber ?? "Not available"}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Goods Issue Date</dt>
                <dd className="text-foreground text-sm font-medium">
                  {formatBusinessDate(order.goodsIssueDate)}
                </dd>
              </div>
            </dl>
          </OperationsPanel>

          <OperationsPanel aria-label="Deliveries">
            <div className="border-border/80 border-b px-5 py-4">
              <h2 className="text-foreground text-base font-semibold">Deliveries</h2>
            </div>
            {order.deliveries.length > 0 ? (
              <ul className="divide-border/80 divide-y">
                {order.deliveries.map((delivery) => (
                  <li className="px-5 py-4 text-sm font-medium" key={delivery.id}>
                    {delivery.deliveryNumber}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                description="Deliveries will appear here when they are associated with this order."
                icon={ClipboardList}
                title="No deliveries"
              />
            )}
          </OperationsPanel>
        </div>

        <div className="space-y-6">
          <OperationsPanel aria-label="Audit metadata">
            <div className="border-border/80 border-b px-5 py-4">
              <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <UserRound aria-hidden="true" className="text-muted-foreground size-4" />
                Audit metadata
              </h2>
            </div>
            <dl className="space-y-4 px-5 py-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground mt-1 font-medium">
                  {formatAuditTimestamp(order.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created by</dt>
                <dd className="text-foreground mt-1 font-medium">
                  {order.createdByName ?? "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="text-foreground mt-1 font-medium">
                  {formatAuditTimestamp(order.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Updated by</dt>
                <dd className="text-foreground mt-1 font-medium">
                  {order.updatedByName ?? "Not available"}
                </dd>
              </div>
            </dl>
          </OperationsPanel>

          <OperationsPanel aria-label="Order activity">
            <div className="border-border/80 border-b px-5 py-4">
              <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
                <Activity aria-hidden="true" className="text-muted-foreground size-4" />
                Activity
              </h2>
            </div>
            <EmptyState
              description="Operational activity will appear here when it is recorded."
              icon={Activity}
              title="No activity recorded"
            />
          </OperationsPanel>
        </div>
      </div>
    </div>
  );
}
