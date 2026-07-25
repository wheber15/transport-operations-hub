/**
 * Deletes operational test data from the approved local date-control database only.
 * It intentionally preserves users, roles, accounts, sessions, app settings, carriers,
 * schema, and Prisma migration history.
 */
import "./load-local-env";

import { prisma } from "../src/server/db/prisma";

const targetDatabase = "axon_clean_dev_datecontrol_20260725";
const confirmation = "RESET_AXON_DEVELOPMENT_DATA";

function assertSafeEnvironment(databaseName: string) {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing reset in production.");
  if (process.env.AXON_RESET_CONFIRMATION !== confirmation)
    throw new Error("Confirmation failed. No data was deleted.");
  if (databaseName !== targetDatabase) throw new Error("Unexpected database target. No data was deleted.");
}

async function counts() {
  const [
    orders,
    deliveries,
    shipments,
    pallets,
    links,
    customers,
    salesReps,
    importBatches,
    importRows,
    reportRuns,
    reportArtifacts,
    reportSnapshots,
    exportRuns,
    exportRows,
    exportArtifacts,
    exportSequences,
    activities,
    repIssues,
  ] = await Promise.all([
    prisma.order.count(), prisma.delivery.count(), prisma.shipment.count(), prisma.pallet.count(),
    prisma.deliveryOrderLink.count(), prisma.customer.count(), prisma.salesRep.count(),
    prisma.importBatch.count(), prisma.importRow.count(), prisma.reportRun.count(),
    prisma.reportArtifact.count(), prisma.reportSnapshotRow.count(), prisma.carrierExportRun.count(),
    prisma.carrierExportRow.count(), prisma.carrierExportArtifact.count(), prisma.carrierExportSequence.count(),
    prisma.activity.count(), prisma.repIssue.count(),
  ]);
  return { orders, deliveries, shipments, pallets, links, customers, salesReps, importBatches, importRows, reportRuns, reportArtifacts, reportSnapshots, exportRuns, exportRows, exportArtifacts, exportSequences, activities, repIssues };
}

async function main() {
  const [database] = await prisma.$queryRawUnsafe<Array<{ current_database: string }>>(
    "SELECT current_database()::text AS current_database"
  );
  const url = new URL(process.env.DATABASE_URL ?? "");
  assertSafeEnvironment(database?.current_database ?? "");

  const [before, administrators, carriers, migrationCount] = await Promise.all([
    counts(),
    prisma.user.findMany({ where: { role: { is: { name: "Administrator" } } }, select: { id: true, email: true } }),
    prisma.carrier.findMany({ select: { id: true, name: true, carrierNumber: true, active: true } }),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>("SELECT COUNT(*) AS count FROM \"_prisma_migrations\"")
  ]);
  if (!administrators.length) throw new Error("No Administrator account found. No data was deleted.");

  await prisma.$transaction(async (tx) => {
    await tx.carrierExportArtifact.deleteMany();
    await tx.carrierExportRow.deleteMany();
    await tx.carrierExportRun.deleteMany();
    await tx.carrierExportSequence.deleteMany();
    await tx.reportArtifact.deleteMany();
    await tx.reportSnapshotRow.deleteMany();
    await tx.reportRun.deleteMany();
    await tx.reportReferenceSequence.deleteMany();
    await tx.importRow.deleteMany();
    await tx.importBatch.deleteMany();
    await tx.activity.deleteMany();
    await tx.repIssue.deleteMany();
    await tx.operationalSchedule.deleteMany();
    await tx.pallet.deleteMany();
    await tx.deliveryOrderLink.deleteMany();
    await tx.delivery.deleteMany();
    await tx.shipment.deleteMany();
    await tx.order.deleteMany();
    await tx.customer.deleteMany();
    await tx.salesRep.deleteMany();
  });

  const after = await counts();
  console.log(JSON.stringify({
    targetDatabase: database.current_database,
    host: url.host,
    preservedAdministrators: administrators.map((user) => ({ id: user.id, email: user.email })),
    retainedCarriers: carriers.map((carrier) => ({ id: carrier.id, carrierNumber: carrier.carrierNumber, name: carrier.name, active: carrier.active })),
    before,
    after,
    migrationCount: migrationCount[0]?.count.toString(),
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
