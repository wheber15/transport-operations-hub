"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

  async function close() {
    const confirmEmpty = deliveryCount === 0;
    if (confirmEmpty && !window.confirm("This Shipment contains no Deliveries. Close it anyway?")) {
      return;
    }

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
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Shipment could not be closed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button disabled={pending} onClick={close} type="button" variant="outline">
      {pending ? "Closing…" : "Close Shipment"}
    </Button>
  );
}
