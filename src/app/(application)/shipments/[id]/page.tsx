import { Activity, ChevronLeft, ClipboardList, Truck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { Button } from "@/components/ui/button";
import {
  formatAuditTimestamp,
  formatBusinessDate,
  formatOperationalNumber,
  formatOperationalWeight,
} from "@/features/shipments/lib/date-formatting";
import {
  ShipmentNotFoundError,
  getShipmentById,
} from "@/features/shipments/services/shipment-service";

type ShipmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

function DeliveryList({
  deliveries,
  emptyDescription,
  emptyTitle,
}: {
  deliveries: Array<{ id: string; deliveryNumber: string; orderNumber: string }>;
  emptyDescription: string;
  emptyTitle: string;
}) {
  if (deliveries.length === 0) {
    return <EmptyState description={emptyDescription} icon={ClipboardList} title={emptyTitle} />;
  }

  return (
    <ul className="divide-border/80 divide-y">
      {deliveries.map((delivery) => (
        <li className="flex items-center justify-between gap-4 px-5 py-4 text-sm" key={delivery.id}>
          <span className="text-foreground font-medium">{delivery.deliveryNumber}</span>
          <span className="text-muted-foreground">Order {delivery.orderNumber}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ShipmentDetailPage({ params }: ShipmentDetailPageProps) {
  const { id } = await params;
  let shipment;

  try {
    shipment = await getShipmentById(id);
  } catch (error) {
    if (error instanceof ShipmentNotFoundError) {
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
          render={<Link href="/shipments" />}
          size="sm"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
          Shipments
        </Button>
        <div>
          <p className="text-primary text-sm font-medium">Shipment</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {shipment.shipmentNumber}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {shipment.carrierName ?? "Carrier unavailable"}
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-6">
          <OperationsPanel aria-label="Shipment information">
            <div className="border-border/80 flex items-center gap-2 border-b px-5 py-4">
              <Truck aria-hidden="true" className="text-muted-foreground size-4" />
              <h2 className="text-foreground text-base font-semibold">Shipment information</h2>
            </div>
            <dl className="divide-border/80 divide-y">
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Carrier</dt>
                <dd className="text-foreground text-sm font-medium">
                  {shipment.carrierName ?? "Not available"}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Dispatch Date</dt>
                <dd className="text-foreground text-sm font-medium">
                  {formatBusinessDate(shipment.dispatchDate)}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Delivery Date</dt>
                <dd className="text-foreground text-sm font-medium">
                  {formatBusinessDate(shipment.deliveryDate)}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Delivery Count</dt>
                <dd className="text-foreground text-sm font-medium">{shipment.deliveryCount}</dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Total Pallets</dt>
                <dd className="text-foreground text-sm font-medium">
                  {formatOperationalNumber(shipment.actualPallets)}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Total Weight</dt>
                <dd className="text-foreground text-sm font-medium">
                  {formatOperationalWeight(shipment.actualWeight)}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-4">
                <dt className="text-muted-foreground text-sm">Notes</dt>
                <dd className="text-foreground text-sm font-medium whitespace-pre-wrap">
                  {shipment.notes ?? "Not available"}
                </dd>
              </div>
            </dl>
          </OperationsPanel>

          <OperationsPanel aria-label="Delivery assignment">
            <div className="border-border/80 border-b px-5 py-4">
              <h2 className="text-foreground text-base font-semibold">Delivery assignment</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Read-only preparation for future planning actions.
              </p>
            </div>
            <div className="divide-border/80 divide-y">
              <div>
                <div className="px-5 pt-5 pb-2">
                  <h3 className="text-foreground text-sm font-medium">Assigned deliveries</h3>
                </div>
                <DeliveryList
                  deliveries={shipment.assignedDeliveries}
                  emptyDescription="Deliveries will appear here when they are assigned to this shipment."
                  emptyTitle="No assigned deliveries"
                />
              </div>
              <div>
                <div className="px-5 pt-5 pb-2">
                  <h3 className="text-foreground text-sm font-medium">Available deliveries</h3>
                </div>
                <DeliveryList
                  deliveries={shipment.availableDeliveries.items}
                  emptyDescription="Unassigned deliveries will appear here when they are available for planning."
                  emptyTitle="No available deliveries"
                />
                {shipment.availableDeliveries.hasMore ? (
                  <p className="text-muted-foreground border-border/80 border-t px-5 py-3 text-sm">
                    Showing the first 100 available deliveries.
                  </p>
                ) : null}
              </div>
            </div>
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
                  {formatAuditTimestamp(shipment.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created by</dt>
                <dd className="text-foreground mt-1 font-medium">
                  {shipment.createdByName ?? "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="text-foreground mt-1 font-medium">
                  {formatAuditTimestamp(shipment.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Updated by</dt>
                <dd className="text-foreground mt-1 font-medium">
                  {shipment.updatedByName ?? "Not available"}
                </dd>
              </div>
            </dl>
          </OperationsPanel>

          <OperationsPanel aria-label="Shipment activity">
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
