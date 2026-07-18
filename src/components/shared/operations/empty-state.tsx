import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = ComponentProps<"div"> & {
  description: string;
  icon: LucideIcon;
  title: string;
};

export function EmptyState({
  className,
  description,
  icon: Icon,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center",
        className
      )}
      {...props}
    >
      <span className="border-border/80 bg-muted/40 text-muted-foreground flex size-9 items-center justify-center rounded-lg border">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <h3 className="text-foreground mt-3 text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-6">{description}</p>
    </div>
  );
}
