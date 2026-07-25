"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { DailyOrdersReportFilters } from "@/features/reports/validation/report-schemas";

function errorMessage(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return "The daily report could not be created.";
}

export function CreateDailyOrdersSnapshotButton({
  filters,
}: {
  filters: DailyOrdersReportFilters;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function createSnapshot() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/reports/daily-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          toast.error(errorMessage(payload));
          return;
        }
        const duplicate =
          typeof payload === "object" &&
          payload !== null &&
          "meta" in payload &&
          typeof payload.meta === "object" &&
          payload.meta !== null &&
          "duplicate" in payload.meta &&
          payload.meta.duplicate === true;
        toast.success(
          duplicate
            ? "A Daily Orders report for this date scope already exists."
            : "Daily report created."
        );
        router.refresh();
      } catch {
        toast.error("The daily report could not be created.");
      }
    });
  }

  return (
    <Button disabled={isPending} onClick={createSnapshot} type="button">
      {isPending ? "Creating report…" : "Generate Daily Report"}
    </Button>
  );
}
