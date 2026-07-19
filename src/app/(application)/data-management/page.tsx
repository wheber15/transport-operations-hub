import type { Metadata } from "next";
import { DataManagementWorkspace } from "@/features/data-management/components/data-management-workspace";
import { listImportBatches } from "@/features/data-management/application/data-import-service";
import { requireAuthenticatedUser } from "@/features/auth/application/session";
export const metadata: Metadata = { title: "Data Management" };
export default async function DataManagementPage() {
  return (
    <DataManagementWorkspace batches={await listImportBatches(await requireAuthenticatedUser())} />
  );
}
