import "server-only";

import { getDeliveryById as getDeliveryByIdFromRepository } from "@/features/deliveries/infrastructure/delivery-repository";

export class DeliveryNotFoundError extends Error {}

export async function getDeliveryById(id: string) {
  const delivery = await getDeliveryByIdFromRepository(id);
  if (!delivery) throw new DeliveryNotFoundError();
  return delivery;
}
