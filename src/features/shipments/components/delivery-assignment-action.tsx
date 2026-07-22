"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";

export function DeliveryAssignmentAction({
  deliveryId,
  deliveryNumber,
  shipmentId,
  shipmentNumber,
  type,
}: {
  deliveryId: string;
  deliveryNumber: string;
  shipmentId: string;
  shipmentNumber: string;
  type: "assign" | "unassign";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isUnassign = type === "unassign";

  async function perform() {
    setPending(true);
    try {
      const response = await fetch(
        isUnassign
          ? `/api/shipments/${shipmentId}/deliveries/${deliveryId}`
          : `/api/shipments/${shipmentId}/deliveries`,
        isUnassign
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deliveryId }),
            }
      );
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Delivery assignment could not be updated.");
      toast.success(isUnassign ? "Delivery unassigned." : "Delivery assigned.");
      setConfirming(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Delivery assignment could not be updated."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        aria-label={`${isUnassign ? "Unassign" : "Assign"} delivery`}
        disabled={pending}
        onClick={isUnassign ? () => setConfirming(true) : perform}
        ref={triggerRef}
        size="sm"
        type="button"
        variant={isUnassign ? "outline" : "default"}
      >
        {pending
          ? isUnassign
            ? "Unassigning…"
            : "Assigning…"
          : isUnassign
            ? "Unassign"
            : "Assign"}
      </Button>
      {isUnassign ? (
        <ConfirmationDialog
          confirmLabel="Unassign Delivery"
          destructive
          onConfirm={perform}
          onOpenChange={setConfirming}
          open={confirming}
          pending={pending}
          title="Unassign delivery?"
          triggerRef={triggerRef}
        >
          Delivery {deliveryNumber} will be removed from Shipment {shipmentNumber}, return to
          Awaiting Shipment, and become available for planning again.
        </ConfirmationDialog>
      ) : null}
    </>
  );
}
