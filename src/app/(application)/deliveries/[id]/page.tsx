import { ChevronLeft, ClipboardList } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/features/auth/application/session";
import {
  DeliveryNotFoundError,
  getDeliveryById,
} from "@/features/deliveries/application/delivery-service";
import { formatBusinessDate } from "@/features/orders/domain/date-formatting";

type DeliveryDetailPageProps = { params: Promise<{ id: string }> };

export default async function DeliveryDetailPage({ params }: DeliveryDetailPageProps) {
  const user = await requireAuthenticatedUser();
  const { id } = await params;
  let delivery;
  try {
    delivery = await getDeliveryById(id);
  } catch (error) {
    if (error instanceof DeliveryNotFoundError) notFound();
    throw error;
  }
  const canViewRecordState = user.role === "Administrator";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:gap-8">
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
          <p className="text-primary text-sm font-medium">Delivery</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {delivery.deliveryNumber}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {delivery.shipmentNumber
              ? `Shipment ${delivery.shipmentNumber}`
              : "Not assigned to a shipment"}
          </p>
        </div>
      </header>

      <OperationsPanel aria-label="Linked Orders">
        <div className="border-border/80 flex items-center gap-2 border-b px-5 py-4">
          <ClipboardList aria-hidden="true" className="text-muted-foreground size-4" />
          <div>
            <h2 className="text-base font-semibold">Linked Orders</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Associations are read-only. The legacy primary Order is identified for context.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Purchase Order</th>
                <th className="px-5 py-3">SAP Gross Weight</th>
                <th className="px-5 py-3">Goods Issue</th>
                <th className="px-5 py-3">Ship-To Party</th>
                {canViewRecordState ? <th className="px-5 py-3">State</th> : null}
              </tr>
            </thead>
            <tbody className="divide-border/80 divide-y">
              {delivery.linkedOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-3 font-medium">
                    <Link
                      className="hover:text-primary underline-offset-4 hover:underline"
                      href={`/orders/${order.id}`}
                    >
                      {order.orderNumber}
                    </Link>
                    {order.isPrimary ? (
                      <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-xs font-medium">
                        Primary Order
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">{order.purchaseOrderNumber ?? "Not set"}</td>
                  <td className="px-5 py-3">
                    {order.grossWeightKg ? `${order.grossWeightKg} kg` : "Not set"}
                  </td>
                  <td className="px-5 py-3">
                    <span>{formatBusinessDate(order.goodsIssueDate)}</span>
                    {order.sapGoodsIssueDate &&
                    order.sapGoodsIssueDate.toISOString().slice(0, 10) !==
                      order.goodsIssueDate?.toISOString().slice(0, 10) ? (
                      <span className="text-muted-foreground mt-1 block text-xs">
                        SAP: {formatBusinessDate(order.sapGoodsIssueDate)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">{order.shipToNumber ?? "Not set"}</td>
                  {canViewRecordState ? (
                    <td className="px-5 py-3">{order.deletedAt ? "Deleted" : "Active"}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OperationsPanel>
    </div>
  );
}
