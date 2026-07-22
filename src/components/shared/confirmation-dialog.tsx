"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/button";

type ConfirmationDialogProps = {
  cancelLabel?: string;
  children: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending?: boolean;
  title: string;
  triggerRef?: RefObject<HTMLElement | null>;
};

/** Accessible confirmation surface for consequential operational actions. */
export function ConfirmationDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  destructive = false,
  error,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
  triggerRef,
}: ConfirmationDialogProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (!pending) onOpenChange(nextOpen);
  }

  return (
    <AlertDialog.Root onOpenChange={handleOpenChange} open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="bg-background/80 fixed inset-0 z-50 min-h-dvh backdrop-blur-sm" />
        <AlertDialog.Viewport className="fixed inset-0 z-50 grid min-h-dvh place-items-center p-4">
          <AlertDialog.Popup
            className="border-border bg-background w-full max-w-md rounded-xl border p-5 shadow-xl"
            finalFocus={triggerRef}
          >
            <div className="space-y-2">
              <AlertDialog.Title className="text-foreground text-base font-semibold">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-muted-foreground text-sm leading-6">
                {children}
              </AlertDialog.Description>
            </div>
            {error ? (
              <p className="text-destructive mt-3 text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                disabled={pending}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                {cancelLabel}
              </Button>
              <Button
                disabled={pending}
                onClick={onConfirm}
                type="button"
                variant={destructive ? "destructive" : "default"}
              >
                {pending ? "Working…" : confirmLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
