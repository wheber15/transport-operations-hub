import "server-only";
import { canManageCarriers } from "@/features/auth/domain/roles";
import {
  carrierFiltersSchema,
  carrierInputSchema,
} from "@/features/carriers/validation/carrier-schemas";
import * as repository from "@/features/carriers/repositories/carrier-repository";

type Actor = { id: string; role: string | null };
export class CarrierForbiddenError extends Error {}
export class CarrierDuplicateError extends Error {}
export class CarrierNotFoundError extends Error {}
function requireManager(actor: Actor) {
  if (!canManageCarriers(actor.role)) throw new CarrierForbiddenError();
}
export async function getCarriers(actor: Actor, input: unknown) {
  const filters = carrierFiltersSchema.parse(input);
  if (!canManageCarriers(actor.role) && filters.state !== "active")
    throw new CarrierForbiddenError();
  return {
    items: await repository.listCarriers(filters),
    summary: await repository.carrierSummary(),
    filters,
  };
}
export async function createCarrier(actor: Actor, input: unknown) {
  requireManager(actor);
  const result = await repository.createCarrier(actor.id, carrierInputSchema.parse(input));
  if (result === "duplicate") throw new CarrierDuplicateError();
  return result;
}
export async function updateCarrier(actor: Actor, id: string, input: unknown) {
  requireManager(actor);
  const result = await repository.updateCarrier(actor.id, id, carrierInputSchema.parse(input));
  if (result === "duplicate") throw new CarrierDuplicateError();
  if (result === "not-found") throw new CarrierNotFoundError();
}
export async function setCarrierActive(actor: Actor, id: string, active: boolean) {
  requireManager(actor);
  if ((await repository.setCarrierActive(actor.id, id, active)).count !== 1)
    throw new CarrierNotFoundError();
}
