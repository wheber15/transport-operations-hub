import { defineConfig, env } from "prisma/config";
import { localEnvironment } from "./scripts/load-local-env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx scripts/seed.ts" },
  datasource: {
    url: env("DIRECT_URL"),
    shadowDatabaseUrl: localEnvironment.shadowUrl,
  },
});
