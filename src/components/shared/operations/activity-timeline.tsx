import { Clock3 } from "lucide-react";

import { EmptyState } from "@/components/shared/operations/empty-state";

export function ActivityTimeline() {
  return (
    <div className="relative min-h-44 overflow-hidden">
      <div aria-hidden="true" className="bg-border absolute top-0 bottom-0 left-5 w-px" />
      <EmptyState
        className="relative"
        description="Operational activity will appear here when available."
        icon={Clock3}
        title="No activity source connected"
      />
    </div>
  );
}
