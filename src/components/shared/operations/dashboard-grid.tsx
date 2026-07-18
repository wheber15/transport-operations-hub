import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type DashboardGridProps = ComponentProps<"div"> & {
  columns?: "two" | "three" | "four";
};

const columnClasses = {
  two: "md:grid-cols-2",
  three: "md:grid-cols-2 xl:grid-cols-3",
  four: "sm:grid-cols-2 xl:grid-cols-4",
} as const;

export function DashboardGrid({
  children,
  className,
  columns = "two",
  ...props
}: DashboardGridProps) {
  return (
    <div className={cn("grid gap-4", columnClasses[columns], className)} {...props}>
      {children}
    </div>
  );
}
