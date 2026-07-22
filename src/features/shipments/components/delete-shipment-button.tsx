"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";

export function DeleteShipmentButton({
  shipmentId,
  shipmentNumber,
  deliveryCount,
}: {
  shipmentId: string;
  shipmentNumber: string;
  deliveryCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
      setOpen(false);
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
      <Button
        onClick={() => setOpen(true)}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="destructive"
      >
        <Trash2 aria-hidden="true" />
        Delete Shipment
      </Button>
      <ConfirmationDialog
        confirmLabel="Delete Shipment"
        destructive
        onConfirm={remove}
        onOpenChange={setOpen}
        open={open}
        pending={pending}
        title={`Delete shipment ${shipmentNumber}?`}
        triggerRef={triggerRef}
      >
        This will release {deliveryCount} assigned {deliveryCount === 1 ? "delivery" : "deliveries"}
        and return {deliveryCount === 1 ? "it" : "them"} to Awaiting Shipment. The shipment will be
        retained in audit history.
      </ConfirmationDialog>
    </>
  );
}
