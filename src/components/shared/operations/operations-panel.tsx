import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function OperationsPanel({ children, className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "border-border/80 bg-card overflow-hidden rounded-xl border shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
