import type { Metadata } from "next";

import { requireAuthenticatedUser } from "@/features/auth/application/session";
import { canMarkCarrierExportsSent } from "@/features/auth/domain/roles";
import { CarrierExportsWorkspace } from "@/features/carrier-exports/components/carrier-exports-workspace";
import {
  listCarrierExportCarriers,
  listCarrierExportHistory,
} from "@/features/carrier-exports/application/carrier-export-service";
import { areOrderExportFieldsAvailable } from "@/features/orders/lib/order-export-field-gate";

export const metadata: Metadata = { title: "Carrier Exports" };

export default async function CarrierExportsPage() {
  const user = await requireAuthenticatedUser();
  const migrationReady = areOrderExportFieldsAvailable();
  const [carriers, history] = await Promise.all([
    listCarrierExportCarriers(user),
    migrationReady ? listCarrierExportHistory(user) : Promise.resolve([]),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5 lg:gap-6">
      <header>
        <p className="text-primary text-sm font-medium">Dachser</p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Carrier Exports
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Create planned, replacement, and addition-only Dachser workbooks with preserved history.
        </p>
      </header>
      <CarrierExportsWorkspace
        canViewDeletedOrders={user.role === "Administrator"}
        canMarkSent={canMarkCarrierExportsSent(user.role)}
        carriers={carriers}
        history={history.map((run) => ({
          ...run,
          totalWeightKg: run.totalWeightKg?.toFixed(3) ?? null,
          generatedAt: run.generatedAt?.toISOString() ?? null,
          artifacts: run.artifacts.map((artifact) => ({
            ...artifact,
            filename: artifact.filename,
          })),
        }))}
        migrationReady={migrationReady}
      />
    </div>
  );
}
