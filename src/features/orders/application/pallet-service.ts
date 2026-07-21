import { canManageDeliveryAssignments } from "@/features/auth/domain/roles";
import {
  getDeliveryPalletWorkspace,
  replaceDeliveryPallets,
} from "@/features/orders/infrastructure/pallet-repository";
import { palletClearSchema, palletSetSchema } from "@/features/orders/validation/pallet-schemas";

type Actor = { id: string; role: string | null };

export class PalletForbiddenError extends Error {}
export class PalletDeliveryNotFoundError extends Error {}

function requirePalletRole(actor: Actor) {
  if (!canManageDeliveryAssignments(actor.role)) throw new PalletForbiddenError();
}

export async function getPalletWorkspace(actor: Actor, deliveryId: string) {
  requirePalletRole(actor);
  const workspace = await getDeliveryPalletWorkspace(deliveryId);
  if (!workspace) throw new PalletDeliveryNotFoundError();
  return workspace;
}

export async function savePalletSet(actor: Actor, deliveryId: string, input: unknown) {
  requirePalletRole(actor);
  const parsed = palletSetSchema.parse(input);
  if (process.env.NODE_ENV === "development") {
    console.info("pallet-save payload validated", {
      deliveryId,
      sequences: parsed.pallets.map((pallet) => pallet.sequenceNumber),
    });
  }
  const workspace = await replaceDeliveryPallets(actor, deliveryId, parsed);
  if (!workspace) throw new PalletDeliveryNotFoundError();
  return workspace;
}

export async function clearPalletSet(actor: Actor, deliveryId: string, input: unknown) {
  requirePalletRole(actor);
  const parsed = palletClearSchema.parse(input);
  const workspace = await replaceDeliveryPallets(actor, deliveryId, { ...parsed, pallets: [] });
  if (!workspace) throw new PalletDeliveryNotFoundError();
  return workspace;
}
