import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  action?: ReactNode;
  className?: string;
  description?: string;
  title: string;
};

export function SectionHeader({ action, className, description, title }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "border-border/80 flex items-start justify-between gap-4 border-b px-5 py-4",
        className
      )}
    >
      <div>
        <h2 className="text-foreground text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
