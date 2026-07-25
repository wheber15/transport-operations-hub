/**
 * Reconciles a fixed, synthetic fixture set for the named clean development database only.
 * It is idempotent for its AXON-prefixed records and must never be used for production data.
 */
import "./load-local-env";

import { hash } from "bcryptjs";

import { roleNames } from "../src/features/auth/domain/roles";
import { prisma } from "../src/server/db/prisma";

const syntheticSeedDatabases = new Set([
  "axon_clean_dev_multiorder_20260724",
  "axon_clean_dev_datecontrol_20260725",
]);

const disallowedDevelopmentPasswords = new Set([
  "password",
  "password123",
  "changeme",
  "admin",
  "planner",
  "replace-with-a-development-password",
]);

function requiredEnvironmentValue(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be configured before running the development seed.`);
  }

  return value;
}

function requiredSeedEmail(name: string) {
  const email = requiredEnvironmentValue(name).trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${name} must be a valid email address.`);
  }

  return email;
}

function requiredSeedPassword(name: string) {
  const password = requiredEnvironmentValue(name);
  const normalizedPassword = password.trim().toLowerCase();

  if (
    password.length < 16 ||
    normalizedPassword.includes("replace-with") ||
    disallowedDevelopmentPasswords.has(normalizedPassword)
  ) {
    throw new Error(
      `${name} must be a non-placeholder development password of at least 16 characters.`
    );
  }

  return password;
}

function assertNonProductionSeed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed execution is not permitted in production.");
  }
}

function assertSyntheticSeedTarget() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured before running the development seed.");
  }

  const databaseName = new URL(connectionString).pathname.replace(/^\//, "");

  if (!syntheticSeedDatabases.has(databaseName)) {
    throw new Error(
      `Synthetic seed execution is restricted to approved clean development databases; received ${databaseName || "none"}.`
    );
  }
}

function businessDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function findOrCreateSalesRep(input: {
  name: string;
  actorId: string;
}) {
  const existing = await prisma.salesRep.findFirst({
    where: { name: input.name },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.salesRep.create({
    data: {
      name: input.name,
      createdById: input.actorId,
      updatedById: input.actorId,
    },
    select: { id: true },
  });
}

async function findOrCreateCustomer(input: {
  name: string;
  salesRepId: string;
  actorId: string;
}) {
  const existing = await prisma.customer.findFirst({
    where: { name: input.name },
    select: { id: true },
  });

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        salesRepId: input.salesRepId,
        updatedById: input.actorId,
      },
      select: { id: true },
    });
  }

  return prisma.customer.create({
    data: {
      name: input.name,
      salesRepId: input.salesRepId,
      createdById: input.actorId,
      updatedById: input.actorId,
    },
    select: { id: true },
  });
}

async function seedSyntheticFixtures(administratorId: string) {
  const [planningRep, operationsRep] = await Promise.all([
    findOrCreateSalesRep({ name: "Synthetic Planning Rep", actorId: administratorId }),
    findOrCreateSalesRep({ name: "Synthetic Operations Rep", actorId: administratorId }),
  ]);

  const [atlasCustomer, beaconCustomer, cedarCustomer] = await Promise.all([
    findOrCreateCustomer({
      name: "Atlas Builders (Synthetic)",
      salesRepId: planningRep.id,
      actorId: administratorId,
    }),
    findOrCreateCustomer({
      name: "Beacon Homeware (Synthetic)",
      salesRepId: operationsRep.id,
      actorId: administratorId,
    }),
    findOrCreateCustomer({
      name: "Cedar Trade (Synthetic)",
      salesRepId: planningRep.id,
      actorId: administratorId,
    }),
  ]);

  const [dachser, inactiveCarrier] = await Promise.all([
    prisma.carrier.upsert({
      where: { carrierNumber: "AXON-DACH-001" },
      create: {
        carrierNumber: "AXON-DACH-001",
        name: "Dachser Synthetic",
        active: true,
        collectionStartTime: "12:00",
        collectionEndTime: "14:00",
        dailyTrailerLimit: 3,
        createdById: administratorId,
        updatedById: administratorId,
      },
      update: {
        active: true,
        deletedAt: null,
        collectionStartTime: "12:00",
        collectionEndTime: "14:00",
        updatedById: administratorId,
      },
      select: { id: true },
    }),
    prisma.carrier.upsert({
      where: { carrierNumber: "AXON-INACTIVE-001" },
      create: {
        carrierNumber: "AXON-INACTIVE-001",
        name: "Inactive Synthetic Carrier",
        active: false,
        createdById: administratorId,
        updatedById: administratorId,
      },
      update: { active: false, updatedById: administratorId },
      select: { id: true },
    }),
  ]);

  void inactiveCarrier;

  const shipment = await prisma.shipment.upsert({
    where: { shipmentNumber: "AXON-SHIP-2407" },
    create: {
      shipmentNumber: "AXON-SHIP-2407",
      carrierId: dachser.id,
      dispatchDate: businessDate("2026-07-24"),
      deliveryDate: businessDate("2026-07-25"),
      notes: "Synthetic release-validation shipment.",
      createdById: administratorId,
      updatedById: administratorId,
    },
    update: {
      carrierId: dachser.id,
      deletedAt: null,
      updatedById: administratorId,
    },
    select: { id: true },
  });

  const orderFixtures = [
    {
      orderNumber: "AXON-ORD-2401",
      deliveryNumber: "AXON-DEL-2401",
      customerId: atlasCustomer.id,
      goodsIssueDate: "2026-07-24",
      grossWeightKg: "1500.000",
      purchaseOrderNumber: "PO / SYN-001",
      shipToNumber: "SYN-AT-001",
      routeCode: "IE1211",
      shipmentId: shipment.id,
      actualPalletCount: 2,
      pallets: ["740.000", "760.000"],
      deleted: false,
    },
    {
      orderNumber: "AXON-ORD-2402",
      deliveryNumber: "AXON-DEL-2402",
      customerId: beaconCustomer.id,
      goodsIssueDate: "2026-07-24",
      grossWeightKg: "750.001",
      purchaseOrderNumber: null,
      shipToNumber: "SYN-BE-002",
      routeCode: "IE1211",
      shipmentId: null,
      actualPalletCount: null,
      pallets: [],
      deleted: false,
    },
    {
      orderNumber: "AXON-ORD-2403",
      deliveryNumber: "AXON-DEL-2403",
      customerId: cedarCustomer.id,
      goodsIssueDate: "2026-07-24",
      grossWeightKg: "2250.001",
      purchaseOrderNumber: "000/PO-SYN 003",
      shipToNumber: "SYN-CE-003",
      routeCode: "IE1211",
      shipmentId: null,
      actualPalletCount: null,
      pallets: [],
      deleted: false,
    },
    {
      orderNumber: "AXON-ORD-2404",
      deliveryNumber: "AXON-DEL-2404",
      customerId: atlasCustomer.id,
      goodsIssueDate: "2026-07-25",
      grossWeightKg: "2956.495",
      purchaseOrderNumber: "PO-SYN-004",
      shipToNumber: "SYN-AT-004",
      routeCode: "IE1212",
      shipmentId: null,
      actualPalletCount: null,
      pallets: [],
      deleted: false,
    },
    {
      orderNumber: "AXON-ORD-DELETED-01",
      deliveryNumber: "AXON-DEL-DELETED-01",
      customerId: beaconCustomer.id,
      goodsIssueDate: "2026-07-24",
      grossWeightKg: "420.000",
      purchaseOrderNumber: null,
      shipToNumber: "SYN-BE-DEL",
      routeCode: "IE1213",
      shipmentId: null,
      actualPalletCount: null,
      pallets: [],
      deleted: true,
    },
  ] as const;

  for (const fixture of orderFixtures) {
    const order = await prisma.order.upsert({
      where: { orderNumber: fixture.orderNumber },
      create: {
        orderNumber: fixture.orderNumber,
        pickingNumber: `PICK-${fixture.orderNumber.slice(-4)}`,
        goodsIssueDate: businessDate(fixture.goodsIssueDate),
        grossWeightKg: fixture.grossWeightKg,
        purchaseOrderNumber: fixture.purchaseOrderNumber,
        shipToNumber: fixture.shipToNumber,
        shipToName2: "Synthetic receiving department",
        shipToStreet: "24 Synthetic Quay",
        shipToCity: "Dublin",
        shipToPostalCode: "D01 SYN1",
        shipToRegion: "Leinster",
        routeCode: fixture.routeCode,
        customerId: fixture.customerId,
        createdById: administratorId,
        updatedById: administratorId,
        deletedAt: fixture.deleted ? new Date("2026-07-23T12:00:00.000Z") : null,
      },
      update: {
        goodsIssueDate: businessDate(fixture.goodsIssueDate),
        grossWeightKg: fixture.grossWeightKg,
        purchaseOrderNumber: fixture.purchaseOrderNumber,
        shipToNumber: fixture.shipToNumber,
        shipToName2: "Synthetic receiving department",
        shipToStreet: "24 Synthetic Quay",
        shipToCity: "Dublin",
        shipToPostalCode: "D01 SYN1",
        shipToRegion: "Leinster",
        routeCode: fixture.routeCode,
        customerId: fixture.customerId,
        deletedAt: fixture.deleted ? new Date("2026-07-23T12:00:00.000Z") : null,
        updatedById: administratorId,
      },
      select: { id: true },
    });

    const delivery = await prisma.delivery.upsert({
      where: { deliveryNumber: fixture.deliveryNumber },
      create: {
        deliveryNumber: fixture.deliveryNumber,
        orderId: order.id,
        shipmentId: fixture.shipmentId,
        actualPalletCount: fixture.actualPalletCount,
        palletCountedAt: fixture.actualPalletCount ? new Date("2026-07-24T09:00:00.000Z") : null,
        palletCountedById: fixture.actualPalletCount ? administratorId : null,
        createdById: administratorId,
        updatedById: administratorId,
      },
      update: {
        orderId: order.id,
        shipmentId: fixture.shipmentId,
        actualPalletCount: fixture.actualPalletCount,
        palletCountedAt: fixture.actualPalletCount ? new Date("2026-07-24T09:00:00.000Z") : null,
        palletCountedById: fixture.actualPalletCount ? administratorId : null,
        deletedAt: null,
        updatedById: administratorId,
      },
      select: { id: true },
    });

    await prisma.deliveryOrderLink.upsert({
      where: { deliveryId_orderId: { deliveryId: delivery.id, orderId: order.id } },
      create: {
        deliveryId: delivery.id,
        orderId: order.id,
        source: "MANUAL",
        createdById: administratorId,
      },
      update: {},
    });

    for (const [index, actualWeight] of fixture.pallets.entries()) {
      const existingPallet = await prisma.pallet.findFirst({
        where: { deliveryId: delivery.id, sequenceNumber: index + 1 },
        select: { id: true },
      });

      if (existingPallet) {
        await prisma.pallet.update({
          where: { id: existingPallet.id },
          data: { actualWeight, deletedAt: null, updatedById: administratorId },
        });
      } else {
        await prisma.pallet.create({
          data: {
            deliveryId: delivery.id,
            sequenceNumber: index + 1,
            actualWeight,
            createdById: administratorId,
            updatedById: administratorId,
          },
        });
      }
    }
  }

  // These associations exercise export-only aggregation and a genuine destination conflict.
  const multiOrder = await prisma.order.upsert({
    where: { orderNumber: "AXON-ORD-2401-B" },
    create: {
      orderNumber: "AXON-ORD-2401-B",
      goodsIssueDate: businessDate("2026-07-24"),
      grossWeightKg: "750.001",
      purchaseOrderNumber: "PO / SYN-001",
      shipToNumber: "SYN-AT-001",
      shipToName2: "Synthetic receiving department",
      shipToStreet: "24 Synthetic Quay",
      shipToCity: "Dublin",
      shipToPostalCode: "D01 SYN1",
      shipToRegion: "Leinster",
      routeCode: "IE1211",
      customerId: atlasCustomer.id,
      createdById: administratorId,
      updatedById: administratorId,
    },
    update: {
      deletedAt: null,
      grossWeightKg: "750.001",
      purchaseOrderNumber: "PO / SYN-001",
      updatedById: administratorId,
    },
    select: { id: true },
  });
  const conflictOrder = await prisma.order.upsert({
    where: { orderNumber: "AXON-ORD-2403-B" },
    create: {
      orderNumber: "AXON-ORD-2403-B",
      goodsIssueDate: businessDate("2026-07-24"),
      grossWeightKg: "500.000",
      purchaseOrderNumber: "PO-SYN-CONFLICT",
      shipToNumber: "SYN-CE-003",
      shipToName2: "Synthetic receiving department",
      shipToStreet: "24 Synthetic Quay",
      shipToCity: "Cork",
      shipToPostalCode: "D01 SYN1",
      shipToRegion: "Leinster",
      routeCode: "IE1211",
      customerId: cedarCustomer.id,
      createdById: administratorId,
      updatedById: administratorId,
    },
    update: {
      deletedAt: null,
      purchaseOrderNumber: "PO-SYN-CONFLICT",
      shipToCity: "Cork",
      updatedById: administratorId,
    },
    select: { id: true },
  });
  const [validDelivery, conflictDelivery] = await Promise.all([
    prisma.delivery.findUniqueOrThrow({
      where: { deliveryNumber: "AXON-DEL-2401" },
      select: { id: true },
    }),
    prisma.delivery.findUniqueOrThrow({
      where: { deliveryNumber: "AXON-DEL-2403" },
      select: { id: true },
    }),
  ]);
  await Promise.all([
    prisma.deliveryOrderLink.upsert({
      where: { deliveryId_orderId: { deliveryId: validDelivery.id, orderId: multiOrder.id } },
      create: { deliveryId: validDelivery.id, orderId: multiOrder.id, source: "MANUAL", createdById: administratorId },
      update: {},
    }),
    prisma.deliveryOrderLink.upsert({
      where: { deliveryId_orderId: { deliveryId: conflictDelivery.id, orderId: conflictOrder.id } },
      create: { deliveryId: conflictDelivery.id, orderId: conflictOrder.id, source: "MANUAL", createdById: administratorId },
      update: {},
    }),
  ]);

  const existingIssue = await prisma.repIssue.findFirst({
    where: { description: "Synthetic planning follow-up", customerId: atlasCustomer.id },
    select: { id: true },
  });

  if (!existingIssue) {
    await prisma.repIssue.create({
      data: {
        description: "Synthetic planning follow-up",
        customerId: atlasCustomer.id,
        salesRepId: planningRep.id,
        createdById: administratorId,
        updatedById: administratorId,
      },
    });
  }

  const existingActivity = await prisma.activity.findFirst({
    where: { entityType: "Order", action: "synthetic_seed_created" },
    select: { id: true },
  });

  if (!existingActivity) {
    await prisma.activity.create({
      data: {
        entityType: "Order",
        entityId: shipment.id,
        action: "synthetic_seed_created",
        description: "Synthetic release-validation data created.",
        metadata: { source: "development-seed" },
        actorId: administratorId,
        createdById: administratorId,
        updatedById: administratorId,
      },
    });
  }
}

async function main() {
  assertNonProductionSeed();
  assertSyntheticSeedTarget();

  const administratorEmail = requiredSeedEmail("SEED_ADMIN_EMAIL");
  const administratorPassword = requiredSeedPassword("SEED_ADMIN_PASSWORD");
  const plannerEmail = requiredSeedEmail("SEED_PLANNER_EMAIL");
  const plannerPassword = requiredSeedPassword("SEED_PLANNER_PASSWORD");

  const administratorRole = await prisma.role.upsert({
    where: { name: roleNames.administrator },
    create: { name: roleNames.administrator },
    update: {},
  });
  const plannerRole = await prisma.role.upsert({
    where: { name: roleNames.planner },
    create: { name: roleNames.planner },
    update: {},
  });

  const [administratorPasswordHash, plannerPasswordHash] = await Promise.all([
    hash(administratorPassword, 12),
    hash(plannerPassword, 12),
  ]);

  const administrator = await prisma.user.upsert({
    where: { email: administratorEmail },
    create: {
      displayName: roleNames.administrator,
      email: administratorEmail,
      passwordHash: administratorPasswordHash,
      roleId: administratorRole.id,
    },
    update: {
      displayName: roleNames.administrator,
      passwordHash: administratorPasswordHash,
      roleId: administratorRole.id,
      deletedAt: null,
    },
  });

  await prisma.user.upsert({
    where: { email: plannerEmail },
    create: {
      displayName: roleNames.planner,
      email: plannerEmail,
      passwordHash: plannerPasswordHash,
      roleId: plannerRole.id,
      createdById: administrator.id,
      updatedById: administrator.id,
    },
    update: {
      displayName: roleNames.planner,
      passwordHash: plannerPasswordHash,
      roleId: plannerRole.id,
      updatedById: administrator.id,
      deletedAt: null,
    },
  });

  await seedSyntheticFixtures(administrator.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
