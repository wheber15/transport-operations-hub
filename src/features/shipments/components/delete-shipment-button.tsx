"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DeleteShipmentButton({
  shipmentId,
  deliveryCount,
}: {
  shipmentId: string;
  deliveryCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  async function remove() {
    setPending(true);
    try {
      const response = await fetch(`/api/shipments/${shipmentId}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as {
        data?: { releasedDeliveryCount?: number };
        error?: { message?: string };
      } | null;
      if (!response.ok)
        throw new Error(payload?.error?.message ?? "Shipment could not be deleted.");
      toast.success(
        `${payload?.data?.releasedDeliveryCount ?? deliveryCount} deliveries returned to Awaiting Shipment.`
      );
      router.push("/shipments");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Shipment could not be deleted.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="destructive">
        <Trash2 aria-hidden="true" />
        Delete Shipment
      </Button>
      {open ? (
        <div
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="bg-background border-border w-full max-w-md rounded-xl border p-5 shadow-xl">
            <h2 className="font-semibold">Delete Shipment?</h2>
            <p className="text-muted-foreground mt-3 text-sm">
              Deleting this shipment will return its assigned deliveries to Awaiting Shipment.
            </p>
            <p className="mt-2 text-sm font-medium">
              {deliveryCount} {deliveryCount === 1 ? "delivery" : "deliveries"} will be released.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={pending} onClick={remove} type="button" variant="destructive">
                {pending ? "Deleting…" : "Delete Shipment"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
