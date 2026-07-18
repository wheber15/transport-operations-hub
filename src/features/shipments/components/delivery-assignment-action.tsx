"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  const isUnassign = type === "unassign";
  async function perform() {
    if (
      isUnassign &&
      !window.confirm(`Unassign delivery ${deliveryNumber} from shipment ${shipmentNumber}?`)
    )
      return;
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
    <Button
      aria-label={`${isUnassign ? "Unassign" : "Assign"} delivery`}
      disabled={pending}
      onClick={perform}
      size="sm"
      type="button"
      variant={isUnassign ? "outline" : "default"}
    >
      {pending ? (isUnassign ? "Unassigning…" : "Assigning…") : isUnassign ? "Unassign" : "Assign"}
    </Button>
  );
}
