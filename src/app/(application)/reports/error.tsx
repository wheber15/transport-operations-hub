"use client";

import { Button } from "@/components/ui/button";

export default function ReportsError({ reset }: { reset: () => void }) {
  return (
    <section className="border-border/70 bg-card mx-auto max-w-2xl rounded-xl border p-6">
      <h1 className="text-lg font-semibold">Reports are temporarily unavailable</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        We could not load this report. Your operational data has not been changed.
      </p>
      <Button className="mt-4" onClick={reset} type="button">
        Try again
      </Button>
    </section>
  );
}
