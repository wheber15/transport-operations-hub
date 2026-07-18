"use client";

import { Button } from "@/components/ui/button";

export default function OrdersError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-foreground text-xl font-semibold">Orders are unavailable</h1>
      <p className="text-muted-foreground max-w-md text-sm leading-6">
        The orders workspace could not be loaded. Please try again.
      </p>
      <Button onClick={reset} type="button">
        Try again
      </Button>
    </div>
  );
}
