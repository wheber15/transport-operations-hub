"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type PurchaseOrderNumberEditorProps = {
  canEdit: boolean;
  orderId: string;
  purchaseOrderNumber: string | null;
};

export function PurchaseOrderNumberEditor({
  canEdit,
  orderId,
  purchaseOrderNumber,
}: PurchaseOrderNumberEditorProps) {
  const router = useRouter();
  const hasPurchaseOrderNumber = Boolean(purchaseOrderNumber);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(purchaseOrderNumber ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setValue(purchaseOrderNumber ?? "");
    setError(null);
    setOpen(false);
  }

  function openEditor() {
    setValue(purchaseOrderNumber ?? "");
    setError(null);
    setOpen(true);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purchaseOrderNumber: value.trim() === "" ? null : value,
        }),
      });
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? ((await response.json()) as { error?: { message?: string } })
        : null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "The server returned an unexpected response.");
      }
      toast.success("Purchase Order Number saved successfully.");
      router.refresh();
      setOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The Purchase Order Number could not be saved."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-foreground text-sm font-medium">
          {purchaseOrderNumber ?? "Not set"}
        </span>
        {canEdit ? (
          <Button onClick={openEditor} size="xs" type="button" variant="outline">
            <Pencil />
            {hasPurchaseOrderNumber ? "Edit" : "Add"}
          </Button>
        ) : null}
      </div>
      {open ? (
        <div
          aria-labelledby="purchase-order-number-title"
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="border-border bg-background w-full max-w-md rounded-xl border shadow-xl">
            <header className="border-border flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold" id="purchase-order-number-title">
                {hasPurchaseOrderNumber ? "Edit" : "Add"} Purchase Order Number
              </h2>
              <Button
                aria-label="Close Purchase Order Number editor"
                disabled={pending}
                onClick={close}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </header>
            <div className="p-5">
              <label className="grid gap-1 text-sm" htmlFor="purchase-order-number">
                Purchase Order Number
                <input
                  autoFocus
                  className="border-input bg-background h-9 rounded-md border px-2"
                  id="purchase-order-number"
                  maxLength={200}
                  onChange={(event) => setValue(event.target.value)}
                  value={value}
                />
              </label>
              <p className="text-muted-foreground mt-2 text-xs">
                Optional. AXon preserves letters, numbers, spaces, slashes, hyphens, and
                punctuation.
              </p>
              {error ? (
                <p className="text-destructive mt-3 text-sm" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <footer className="border-border flex justify-end gap-2 border-t px-5 py-4">
              <Button disabled={pending} onClick={close} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={pending} onClick={save} type="button">
                {pending ? "Saving..." : "Save changes"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
