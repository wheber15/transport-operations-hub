"use client";

import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open user menu"
        className="rounded-full"
        onClick={() => setOpen((current) => !current)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <UserRound aria-hidden="true" />
      </Button>
      {open ? (
        <div
          aria-label="User menu"
          className="border-border bg-popover absolute top-[calc(100%+0.5rem)] right-0 z-30 w-64 rounded-xl border p-3 shadow-xl shadow-slate-950/15"
          role="menu"
        >
          <p className="text-popover-foreground text-sm font-semibold">User account</p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Account controls will be available when authentication is configured.
          </p>
        </div>
      ) : null}
    </div>
  );
}
