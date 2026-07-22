import { Activity } from "lucide-react";

import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import type { ShipmentActivity } from "@/features/shipments/types/shipment";
import { formatIrelandDateTime } from "@/lib/business-date";

function metadataSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const released = (metadata as { releasedDeliveryCount?: unknown }).releasedDeliveryCount;
  return typeof released === "number"
    ? `${released} ${released === 1 ? "delivery was" : "deliveries were"} released.`
    : null;
}

export function ShipmentActivityPanel({ activities }: { activities: ShipmentActivity[] }) {
  return (
    <OperationsPanel aria-label="Shipment activity">
      <div className="border-border/80 border-b px-5 py-4">
        <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
          <Activity aria-hidden="true" className="text-muted-foreground size-4" />
          Activity
        </h2>
      </div>
      {activities.length === 0 ? (
        <EmptyState
          description="Operational activity will appear here when it is recorded."
          icon={Activity}
          title="No activity recorded"
        />
      ) : (
        <ol className="divide-border/80 divide-y">
          {activities.map((activity, index) => (
            <li
              className="px-5 py-4"
              key={`${activity.action}-${activity.occurredAt.toISOString()}-${index}`}
            >
              <p className="text-foreground text-sm font-medium">{activity.description}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {activity.actorName ?? "Unknown user"} ·{" "}
                {formatIrelandDateTime(activity.occurredAt)}
              </p>
              {metadataSummary(activity.metadata) ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {metadataSummary(activity.metadata)}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </OperationsPanel>
  );
}
