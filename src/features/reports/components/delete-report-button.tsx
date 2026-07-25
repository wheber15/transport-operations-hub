"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";
export function DeleteReportButton({ reportRunId }: { reportRunId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const remove = () =>
    start(async () => {
      const response = await fetch(`/api/reports/${reportRunId}/artifacts/XLSX`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("The report could not be deleted safely.");
        return;
      }
      toast.success("Report deleted successfully.");
      setOpen(false);
      router.refresh();
    });
  return (
    <>
      <Button variant="destructive" size="sm" type="button" onClick={() => setOpen(true)}>
        Delete Report
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={remove}
        title="Delete Report"
        confirmLabel="Delete Report"
        destructive
        pending={pending}
      >
        This will permanently remove the report history, stored snapshot and any generated report
        artifacts. This action cannot be undone.
      </ConfirmationDialog>
    </>
  );
}
