import { config } from "dotenv";

export const approvedDevelopmentDatabase = "axon_clean_dev_datecontrol_20260725";
export const approvedShadowDatabase = "axon_clean_shadow_datecontrol_20260725";

function required(name: "DATABASE_URL" | "DIRECT_URL") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Local AXon execution was aborted.`);
  return value;
}

function targetUrl(value: string, database: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Database URL parsing failed. Local AXon execution was aborted.");
  }
  url.pathname = `/${database}`;
  return url.toString();
}

export function loadApprovedLocalEnvironment() {
  config();
  config({ path: ".env.local", override: true });

  const selectedDatabase = process.env.AXON_LOCAL_DATABASE?.trim();
  const selectedShadowDatabase = process.env.AXON_LOCAL_SHADOW_DATABASE?.trim();
  if (selectedDatabase !== approvedDevelopmentDatabase)
    throw new Error(`AXON_LOCAL_DATABASE must be ${approvedDevelopmentDatabase}.`);
  if (selectedShadowDatabase !== approvedShadowDatabase)
    throw new Error(`AXON_LOCAL_SHADOW_DATABASE must be ${approvedShadowDatabase}.`);

  const runtimeUrl = targetUrl(required("DATABASE_URL"), approvedDevelopmentDatabase);
  const directUrl = targetUrl(required("DIRECT_URL"), approvedDevelopmentDatabase);
  const shadowUrl = targetUrl(required("DIRECT_URL"), approvedShadowDatabase);
  process.env.DATABASE_URL = runtimeUrl;
  process.env.DIRECT_URL = directUrl;
  process.env.SHADOW_DATABASE_URL = shadowUrl;
  process.env.ORDER_EXPORT_FIELDS_AVAILABLE = "true";

  return {
    database: approvedDevelopmentDatabase,
    shadowDatabase: approvedShadowDatabase,
    runtimeUrl,
    directUrl,
    shadowUrl,
    host: new URL(runtimeUrl).host,
  };
}

export const localEnvironment = loadApprovedLocalEnvironment();
