import { prisma } from "@/server/db/prisma";

const credentialUserSelect = {
  id: true,
  displayName: true,
  email: true,
  passwordHash: true,
  role: {
    select: {
      name: true,
    },
  },
} as const;

const currentUserSelect = {
  id: true,
  displayName: true,
  email: true,
  role: {
    select: {
      name: true,
    },
  },
} as const;

export async function findActiveUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
      role: {
        is: {
          deletedAt: null,
        },
      },
    },
    select: credentialUserSelect,
  });
}

export async function findActiveUserById(id: string) {
  return prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
      role: {
        is: {
          deletedAt: null,
        },
      },
    },
    select: currentUserSelect,
  });
}
