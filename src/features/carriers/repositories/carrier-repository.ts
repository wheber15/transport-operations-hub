import "server-only";

import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import type { carrierInputSchema } from "@/features/carriers/validation/carrier-schemas";

export type CarrierFilters = { query?: string; state: "active" | "inactive" | "all" };
export type CarrierInput = z.output<typeof carrierInputSchema>;

function where(filters: CarrierFilters): Prisma.CarrierWhereInput {
  const active = filters.state === "all" ? undefined : filters.state === "active";
  const query = filters.query?.trim();
  return {
    deletedAt: null,
    ...(active === undefined ? {} : { active }),
    ...(query
      ? {
          OR: ["carrierNumber", "name", "contactName", "email", "phone"].map((field) => ({
            [field]: { contains: query, mode: "insensitive" },
          })),
        }
      : {}),
  };
}

const select = {
  id: true,
  carrierNumber: true,
  name: true,
  active: true,
  contactName: true,
  email: true,
  phone: true,
  collectionStartTime: true,
  collectionEndTime: true,
  dailyTrailerLimit: true,
  notes: true,
} satisfies Prisma.CarrierSelect;

export async function listCarriers(filters: CarrierFilters) {
  return prisma.carrier.findMany({
    where: where(filters),
    select,
    orderBy: [{ active: "desc" }, { name: "asc" }, { id: "asc" }],
  });
}
export async function carrierSummary() {
  const [active, inactive, collectionTimes, trailerLimits] = await Promise.all([
    prisma.carrier.count({ where: { deletedAt: null, active: true } }),
    prisma.carrier.count({ where: { deletedAt: null, active: false } }),
    prisma.carrier.count({ where: { deletedAt: null, collectionStartTime: { not: null } } }),
    prisma.carrier.count({ where: { deletedAt: null, dailyTrailerLimit: { not: null } } }),
  ]);
  return { active, inactive, collectionTimes, trailerLimits };
}
export async function createCarrier(actorId: string, input: CarrierInput) {
  try {
    return await prisma.carrier.create({
      data: { ...input, createdById: actorId, updatedById: actorId },
      select,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
      return "duplicate" as const;
    throw error;
  }
}
export async function updateCarrier(actorId: string, id: string, input: CarrierInput) {
  try {
    const result = await prisma.carrier.updateMany({
      where: { id, deletedAt: null },
      data: { ...input, updatedById: actorId },
    });
    return result.count === 1 ? ("updated" as const) : ("not-found" as const);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
      return "duplicate" as const;
    throw error;
  }
}
export async function setCarrierActive(actorId: string, id: string, active: boolean) {
  return prisma.carrier.updateMany({
    where: { id, deletedAt: null },
    data: { active, updatedById: actorId },
  });
}
