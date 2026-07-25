import "server-only";

import { resolve, sep } from "node:path";

import {
  LocalReportArtifactStorage,
  ReportArtifactStorageConfigurationError,
} from "@/features/reports/infrastructure/local-report-artifact-storage";

export function getLocalCarrierExportArtifactStorage(environment: NodeJS.ProcessEnv = process.env) {
  const configuredRoot = environment.CARRIER_EXPORT_ARTIFACT_STORAGE_ROOT;
  if (environment.NODE_ENV === "production" && !configuredRoot) {
    throw new ReportArtifactStorageConfigurationError();
  }
  const root = configuredRoot
    ? resolve(/* turbopackIgnore: true */ configuredRoot)
    : resolve(process.cwd(), ".local-carrier-export-artifacts");
  const publicDirectory = resolve("public");
  if (root === publicDirectory || root.startsWith(`${publicDirectory}${sep}`)) {
    throw new ReportArtifactStorageConfigurationError();
  }
  return new LocalReportArtifactStorage(root);
}
