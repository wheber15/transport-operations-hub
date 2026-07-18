"use client";

import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { data: session, status } = useSession();
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
          <p className="text-popover-foreground text-sm font-semibold">
            {status === "authenticated" ? session.user.name : "Loading account"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {status === "authenticated"
              ? (session.user.role ?? "No role assigned")
              : "Loading session"}
          </p>
          <Button
            className="mt-3 w-full"
            disabled={status !== "authenticated"}
            onClick={() => signOut({ callbackUrl: "/login" })}
            size="sm"
            type="button"
            variant="outline"
          >
            Sign out
          </Button>
        </div>
      ) : null}
    </div>
  );
}
