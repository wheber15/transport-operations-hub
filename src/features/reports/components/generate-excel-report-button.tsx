"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function message(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  )
    return payload.error.message;
  return "The Excel report could not be generated.";
}

export function GenerateExcelReportButton({ reportRunId }: { reportRunId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function generate() {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/reports/${reportRunId}/artifacts/XLSX`, {
          method: "POST",
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          toast.error(message(payload));
          return;
        }
        toast.success("Excel report generated.");
        router.refresh();
      } catch {
        toast.error("The Excel report could not be generated.");
      }
    });
  }
  return (
    <Button disabled={isPending} onClick={generate} size="sm" type="button" variant="outline">
      {isPending ? "Generating Excel…" : "Generate Excel Report"}
    </Button>
  );
}
