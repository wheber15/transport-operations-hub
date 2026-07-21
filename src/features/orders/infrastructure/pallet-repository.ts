import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { calculatePalletWeightSummary } from "@/features/orders/domain/pallets";
import type { PalletSetInput } from "@/features/orders/validation/pallet-schemas";

type PalletActor = { id: string };

export type DeliveryPalletWorkspace = {
  deliveryId: string;
  deliveryNumber: string;
  orderNumber: string;
  customerName: string;
  sapGrossWeightKg: string | null;
  updatedAt: Date;
  pallets: Array<{ id: string; sequenceNumber: number; actualWeightKg: string; note: string | null }>;
  summary: ReturnType<typeof calculatePalletWeightSummary>;
};

function toWorkspace(delivery: {
  id: string;
  deliveryNumber: string;
  updatedAt: Date;
  order: { orderNumber: string; grossWeightKg: { toFixed: (digits: number) => string } | null; customer: { name: string } };
  pallets: Array<{ id: string; sequenceNumber: number; actualWeight: { toFixed: (digits: number) => string }; note: string | null }>;
}): DeliveryPalletWorkspace {
  const pallets = delivery.pallets.map((pallet) => ({
    id: pallet.id,
    sequenceNumber: pallet.sequenceNumber,
    actualWeightKg: pallet.actualWeight.toFixed(3),
    note: pallet.note,
  }));
  const sapGrossWeightKg = delivery.order.grossWeightKg?.toFixed(3) ?? null;
  return {
    deliveryId: delivery.id,
    deliveryNumber: delivery.deliveryNumber,
    orderNumber: delivery.order.orderNumber,
    customerName: delivery.order.customer.name,
    sapGrossWeightKg,
    updatedAt: delivery.updatedAt,
    pallets,
    summary: calculatePalletWeightSummary(pallets.map((pallet) => pallet.actualWeightKg), sapGrossWeightKg),
  };
}

const palletWorkspaceSelect = {
  id: true,
  deliveryNumber: true,
  updatedAt: true,
  order: { select: { orderNumber: true, grossWeightKg: true, customer: { select: { name: true } } } },
  pallets: {
    where: { deletedAt: null },
    orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
    select: { id: true, sequenceNumber: true, actualWeight: true, note: true },
  },
} satisfies Prisma.DeliverySelect;

export async function getDeliveryPalletWorkspace(deliveryId: string) {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, deletedAt: null, order: { is: { deletedAt: null } } },
    select: palletWorkspaceSelect,
  });
  return delivery ? toWorkspace(delivery) : null;
}

export async function replaceDeliveryPallets(
  actor: PalletActor,
  deliveryId: string,
  input: PalletSetInput
) {
  return prisma.$transaction(async (tx) => {
    if (process.env.NODE_ENV === "development") console.info("pallet-save transaction started", { deliveryId });
    const delivery = await tx.delivery.findFirst({
      where: { id: deliveryId, deletedAt: null, order: { is: { deletedAt: null } } },
      select: { id: true, deliveryNumber: true, updatedAt: true },
    });
    if (!delivery) return null;
    if (process.env.NODE_ENV === "development") {
      console.info("pallet-save delivery loaded", { deliveryNumber: delivery.deliveryNumber });
    }
    if (input.updatedAt && delivery.updatedAt.getTime() !== new Date(input.updatedAt).getTime()) {
      throw new Error("STALE_RECORD");
    }

    const current = await tx.pallet.findMany({
      where: { deliveryId, deletedAt: null },
      select: { id: true, sequenceNumber: true, actualWeight: true, note: true },
    });
    if (input.pallets.some((pallet) => pallet.id && !current.some((existing) => existing.id === pallet.id))) {
      throw new Error("PALLET_NOT_FOUND");
    }

    // Soft-delete first so the active partial unique index permits safe resequencing.
    await tx.pallet.updateMany({
      where: { deliveryId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    if (input.pallets.length > 0) {
      await tx.pallet.createMany({
        data: input.pallets.map((pallet) => ({
          deliveryId,
          sequenceNumber: pallet.sequenceNumber,
          actualWeight: pallet.actualWeightKg,
          note: pallet.note ?? null,
          createdById: actor.id,
          updatedById: actor.id,
        })),
      });
      if (process.env.NODE_ENV === "development") {
        console.info("pallet-save pallet rows persisted", {
          deliveryNumber: delivery.deliveryNumber,
          sequences: input.pallets.map((pallet) => pallet.sequenceNumber),
        });
      }
    }
    const count = input.pallets.length;
    await tx.delivery.update({
      where: { id: deliveryId },
      data: { actualPalletCount: count === 0 ? null : count, updatedById: actor.id },
    });
    await tx.activity.create({
      data: {
        entityType: "Delivery",
        entityId: deliveryId,
        action: "pallets_replaced",
        description: `Pallet records updated for Delivery ${delivery.deliveryNumber}.`,
        metadata: { previousPalletCount: current.length, palletCount: count },
        actorId: actor.id,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    if (process.env.NODE_ENV === "development") {
      console.info("pallet-save activity written", { deliveryNumber: delivery.deliveryNumber });
    }
    const updated = await tx.delivery.findUnique({ where: { id: deliveryId }, select: palletWorkspaceSelect });
    if (process.env.NODE_ENV === "development") {
      console.info("pallet-save transaction completed", { deliveryNumber: delivery.deliveryNumber });
    }
    return updated ? toWorkspace(updated) : null;
  });
}
