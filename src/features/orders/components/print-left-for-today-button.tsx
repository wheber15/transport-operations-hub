"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function PrintLeftForTodayButton() {
  const [pending, setPending] = useState(false);
  async function download() {
    setPending(true);
    try {
      const response = await fetch("/api/orders/left-for-today", { cache: "no-store" });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        const payload = contentType.includes("application/json") ? await response.json() : null;
        throw new Error(payload?.error?.message ?? "Orders left workbook could not be generated.");
      }
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        toast.info(payload.message ?? "No orders are left for today.");
        return;
      }
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? "Orders left.xlsx";
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Orders left workbook could not be generated."
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Button disabled={pending} onClick={download} size="sm" type="button" variant="outline">
      <Download aria-hidden="true" />
      {pending ? "Preparing…" : "Print Left for Today"}
    </Button>
  );
}
