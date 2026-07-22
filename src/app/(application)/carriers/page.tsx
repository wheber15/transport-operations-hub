import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { EmptyState } from "@/components/shared/operations/empty-state";
import { OperationsPanel } from "@/components/shared/operations/operations-panel";
import { requireAuthenticatedUser } from "@/features/auth/application/session";
import { canManageCarriers } from "@/features/auth/domain/roles";
import { CarrierManagement } from "@/features/carriers/components/carrier-management";
import { Button } from "@/components/ui/button";
import { getCarriers } from "@/features/carriers/services/carrier-service";
export const metadata: Metadata = { title: "Carriers" };
export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const result = await getCarriers(user, {
    query: params.query,
    state: canManageCarriers(user.role) ? (params.state ?? "active") : "active",
  });
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-primary text-sm font-medium">Master data</p>
          <h1 className="mt-2 text-3xl font-semibold">Carriers</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage transport providers and collection information
          </p>
        </div>
        <CarrierManagement canManage={canManageCarriers(user.role)} items={[]} />
      </header>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Active Carriers", result.summary.active],
          ["Inactive Carriers", result.summary.inactive],
          ["With collection times", result.summary.collectionTimes],
          ["With daily trailer limits", result.summary.trailerLimits],
        ].map(([label, value]) => (
          <OperationsPanel key={String(label)}>
            <p className="text-muted-foreground p-4 text-sm">{label}</p>
            <p className="px-4 pb-4 text-2xl font-semibold">{value}</p>
          </OperationsPanel>
        ))}
      </div>
      <form className="flex gap-2" method="get">
        <input
          className="border-input h-9 rounded border px-2"
          defaultValue={params.query}
          name="query"
          placeholder="Search Carriers"
        />
        <select
          className="border-input h-9 rounded border px-2"
          defaultValue={canManageCarriers(user.role) ? (params.state ?? "active") : "active"}
          disabled={!canManageCarriers(user.role)}
          name="state"
        >
          <option value="active">Active</option>
          {canManageCarriers(user.role) ? (
            <>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </>
          ) : null}
        </select>
        <Button size="sm" type="submit" variant="outline">
          Apply
        </Button>
      </form>
      <OperationsPanel aria-label="Carriers workspace">
        {result.items.length ? (
          <CarrierManagement canManage={canManageCarriers(user.role)} items={result.items} />
        ) : (
          <EmptyState
            title="No Carriers available"
            description="Create a Carrier to make it available for new Shipments."
            icon={Truck}
          />
        )}
      </OperationsPanel>
    </div>
  );
}
