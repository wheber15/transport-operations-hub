"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";

export function CloseShipmentButton({
  shipmentId,
  deliveryCount,
}: {
  shipmentId: string;
  deliveryCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  async function close(confirmEmpty = false) {
    setPending(true);
    try {
      const response = await fetch(`/api/shipments/${shipmentId}/close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmpty: confirmEmpty || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) throw new Error(payload?.error?.message ?? "Shipment could not be closed.");

      toast.success("Shipment closed.");
      setConfirmingEmpty(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Shipment could not be closed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        disabled={pending}
        onClick={deliveryCount === 0 ? () => setConfirmingEmpty(true) : () => close()}
        ref={triggerRef}
        type="button"
        variant="outline"
      >
        {pending ? "Closing…" : "Close Shipment"}
      </Button>
      <ConfirmationDialog
        confirmLabel="Close Shipment"
        onConfirm={() => close(true)}
        onOpenChange={setConfirmingEmpty}
        open={confirmingEmpty}
        pending={pending}
        title="Close empty Shipment?"
        triggerRef={triggerRef}
      >
        This Shipment contains no Deliveries. Close it anyway?
      </ConfirmationDialog>
    </>
  );
}
