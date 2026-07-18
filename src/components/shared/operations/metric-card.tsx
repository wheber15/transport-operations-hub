import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  description: string;
  icon: LucideIcon;
  label: string;
};

export function MetricCard({ description, icon: Icon, label }: MetricCardProps) {
  return (
    <article className="border-border/80 bg-card min-h-36 rounded-xl border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          <p className="text-foreground mt-4 text-2xl font-semibold tracking-tight">—</p>
        </div>
        <span className="border-border/80 bg-muted/40 text-muted-foreground flex size-9 items-center justify-center rounded-lg border">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
    </article>
  );
}
