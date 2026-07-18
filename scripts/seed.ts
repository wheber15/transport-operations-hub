import "dotenv/config";

import { hash } from "bcryptjs";

import { roleNames } from "../src/features/auth/domain/roles";
import { prisma } from "../src/server/db/prisma";

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

async function main() {
  assertNonProductionSeed();

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
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
