import "server-only";

import {
  assignDeliveryAtomically,
  getById as getShipmentByIdFromRepository,
  list as listShipmentsFromRepository,
  listAvailableDeliveries as listAvailableDeliveriesFromRepository,
  listDeliveries as listDeliveriesFromRepository,
  search as searchShipmentsFromRepository,
  unassignDeliveryAtomically,
} from "@/features/shipments/repositories/shipment-repository";
import type {
  ShipmentActivityRecorder,
  ShipmentSearchFilters,
} from "@/features/shipments/types/shipment";
import {
  deliveryAssignmentRouteSchema,
  deliveryAssignmentSchema,
  shipmentIdSchema,
  shipmentSearchFiltersSchema,
} from "@/features/shipments/validation/shipment-schemas";
import { canManageDeliveryAssignments } from "@/features/auth/domain/roles";

export class ShipmentNotFoundError extends Error {
  constructor() {
    super("Shipment not found.");
  }
}

export class DeliveryNotFoundError extends Error {}
export class DeliveryAssignmentConflictError extends Error {}
export class DeliveryAssignmentForbiddenError extends Error {}

type DeliveryAssignmentActor = { id: string; role: string | null };

function requireDeliveryAssignmentRole(actor: DeliveryAssignmentActor) {
  if (!canManageDeliveryAssignments(actor.role)) throw new DeliveryAssignmentForbiddenError();
}

export async function assignDeliveryToShipment(
  actor: DeliveryAssignmentActor,
  shipmentIdInput: unknown,
  input: unknown
) {
  requireDeliveryAssignmentRole(actor);
  const shipmentId = shipmentIdSchema.parse(shipmentIdInput);
  const payload = deliveryAssignmentSchema.parse(input);
  const result = await assignDeliveryAtomically({ actorId: actor.id, shipmentId, ...payload });
  if (result === "shipment-not-found") throw new ShipmentNotFoundError();
  if (result === "delivery-not-found") throw new DeliveryNotFoundError();
  if (result === "conflict") throw new DeliveryAssignmentConflictError();
  return { deliveryId: payload.deliveryId, shipmentId };
}

export async function unassignDeliveryFromShipment(actor: DeliveryAssignmentActor, input: unknown) {
  requireDeliveryAssignmentRole(actor);
  const payload = deliveryAssignmentRouteSchema.parse(input);
  const result = await unassignDeliveryAtomically({ actorId: actor.id, ...payload });
  if (result === "shipment-not-found") throw new ShipmentNotFoundError();
  if (result === "delivery-not-found") throw new DeliveryNotFoundError();
  if (result === "conflict") throw new DeliveryAssignmentConflictError();
  return { deliveryId: payload.deliveryId, shipmentId: payload.shipmentId };
}

export type ShipmentServiceDependencies = {
  activityRecorder?: ShipmentActivityRecorder;
};

export async function listShipments(input: unknown) {
  const filters = shipmentSearchFiltersSchema.parse(input);
  const result = await listShipmentsFromRepository(filters);

  return { ...result, filters };
}

export async function searchShipments(query: unknown) {
  const filters = shipmentSearchFiltersSchema.parse({ query });

  return searchShipmentsFromRepository(filters.query ?? "", filters.page, filters.pageSize);
}

export async function getShipmentById(input: unknown) {
  const id = shipmentIdSchema.parse(input);
  const shipment = await getShipmentByIdFromRepository(id);

  if (!shipment) {
    throw new ShipmentNotFoundError();
  }

  const [assignedDeliveries, availableDeliveries] = await Promise.all([
    listDeliveriesFromRepository(id),
    listAvailableDeliveriesFromRepository(),
  ]);

  return {
    ...shipment,
    assignedDeliveries,
    availableDeliveries,
  };
}

export function getShipmentActivityRecorder(dependencies: ShipmentServiceDependencies) {
  return dependencies.activityRecorder;
}

export function getValidatedShipmentFilters(input: unknown): ShipmentSearchFilters {
  return shipmentSearchFiltersSchema.parse(input);
}
