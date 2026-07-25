import "server-only";

import { prisma } from "@/server/db/prisma";

const approvedDevelopmentDatabase = "axon_clean_dev_datecontrol_20260725";

export async function assertDevelopmentRuntime() {
  if (process.env.NODE_ENV !== "development") return;
  const [result] = await prisma.$queryRawUnsafe<Array<{ current_database: string }>>(
    "SELECT current_database()::text AS current_database"
  );
  if (result?.current_database !== approvedDevelopmentDatabase)
    throw new Error(`AXon development runtime database is invalid: ${result?.current_database ?? "unknown"}`);
}

export async function getDevelopmentRuntimeStatus() {
  await assertDevelopmentRuntime();
  const [counts, database] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ orders: bigint; deliveries: bigint }>>(
      'SELECT (SELECT COUNT(*) FROM "order") AS orders, (SELECT COUNT(*) FROM delivery) AS deliveries'
    ),
    prisma.$queryRawUnsafe<Array<{ current_database: string }>>(
      "SELECT current_database()::text AS current_database"
    ),
  ]);
  return {
    database: database[0]?.current_database ?? "unknown",
    mode: process.env.NODE_ENV,
    orderExportFieldsAvailable: process.env.ORDER_EXPORT_FIELDS_AVAILABLE === "true",
    orders: Number(counts[0]?.orders ?? 0),
    deliveries: Number(counts[0]?.deliveries ?? 0),
  };
}
