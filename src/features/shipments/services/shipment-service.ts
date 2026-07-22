import "server-only";

import {
  assignDeliveryAtomically,
  getById as getShipmentByIdFromRepository,
  list as listShipmentsFromRepository,
  getSummary as getShipmentsSummaryFromRepository,
  listAvailableDeliveries as listAvailableDeliveriesFromRepository,
  listDeliveries as listDeliveriesFromRepository,
  listActiveCarriers as listActiveCarriersFromRepository,
  listCarriersForShipmentFilters as listCarriersForShipmentFiltersFromRepository,
  isActiveCarrier,
  search as searchShipmentsFromRepository,
  unassignDeliveryAtomically,
  createShipment as createShipmentFromRepository,
  closeShipment as closeShipmentFromRepository,
  deleteShipment as deleteShipmentFromRepository,
  updateOpenShipment as updateOpenShipmentFromRepository,
  updateMovementTimesAtomically,
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
  shipmentCreateSchema,
  shipmentCloseSchema,
  shipmentUpdateSchema,
  shipmentMovementSchema,
} from "@/features/shipments/validation/shipment-schemas";
import { irelandLocalDateTimeToUtc } from "@/features/shipments/domain/movement";
import { canManageDeliveryAssignments } from "@/features/auth/domain/roles";
import { resolveDispatchDateScope } from "@/features/shipments/domain/dispatch-date";
import { suggestDeliveryDate } from "@/features/shipments/domain/delivery-date";

export class ShipmentNotFoundError extends Error {
  constructor() {
    super("Shipment not found.");
  }
}

export class DeliveryNotFoundError extends Error {}
export class DeliveryAssignmentConflictError extends Error {}
export class DeliveryAssignmentForbiddenError extends Error {}
export class ShipmentClosedError extends Error {}
export class ShipmentDuplicateError extends Error {}
export class ShipmentEmptyError extends Error {}
export class ShipmentCarrierUnavailableError extends Error {}
export class ShipmentDeleteNotFoundError extends Error {}
export class ShipmentMovementNotFoundError extends Error {}

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

export async function createShipment(actor: DeliveryAssignmentActor, input: unknown) {
  requireDeliveryAssignmentRole(actor);
  const payload = shipmentCreateSchema.parse(input);
  if (!(await isActiveCarrier(payload.carrierId))) throw new ShipmentCarrierUnavailableError();
  const shipment = await createShipmentFromRepository(actor.id, {
    ...payload,
    deliveryDate:
      payload.deliveryDate ?? suggestDeliveryDate(payload.dispatchDate, payload.saturdayOvertime),
  });
  if (shipment === "duplicate") throw new ShipmentDuplicateError();
  return shipment;
}

export async function closeShipment(actor: DeliveryAssignmentActor, id: unknown, input: unknown) {
  requireDeliveryAssignmentRole(actor);
  const { confirmEmpty } = shipmentCloseSchema.parse(input);
  const result = await closeShipmentFromRepository(
    actor.id,
    shipmentIdSchema.parse(id),
    confirmEmpty === true
  );
  if (result === "empty") throw new ShipmentEmptyError();
  if (result === "not-open") throw new ShipmentClosedError();
}

export async function updateOpenShipment(
  actor: DeliveryAssignmentActor,
  id: unknown,
  input: unknown
) {
  requireDeliveryAssignmentRole(actor);
  const payload = shipmentUpdateSchema.parse(input);
  if (payload.carrierId && !(await isActiveCarrier(payload.carrierId))) {
    throw new ShipmentCarrierUnavailableError();
  }
  const result = await updateOpenShipmentFromRepository(actor.id, shipmentIdSchema.parse(id), {
    ...payload,
    deliveryDate:
      payload.deliveryDate ??
      (payload.dispatchDate
        ? suggestDeliveryDate(payload.dispatchDate, payload.saturdayOvertime)
        : undefined),
  });
  if (result === "duplicate") throw new ShipmentDuplicateError();
  if (result === "not-open") throw new ShipmentClosedError();
}

export async function deleteShipment(actor: DeliveryAssignmentActor, id: unknown) {
  requireDeliveryAssignmentRole(actor);
  const result = await deleteShipmentFromRepository(actor.id, shipmentIdSchema.parse(id));
  if (result === "not-found") throw new ShipmentDeleteNotFoundError();
  return result;
}

export async function updateShipmentMovement(
  actor: DeliveryAssignmentActor,
  id: unknown,
  input: unknown
) {
  requireDeliveryAssignmentRole(actor);
  const payload = shipmentMovementSchema.parse(input);
  const result = await updateMovementTimesAtomically({
    actorId: actor.id,
    shipmentId: shipmentIdSchema.parse(id),
    times: {
      driverInAt: payload.driverInAt ? irelandLocalDateTimeToUtc(payload.driverInAt) : null,
      trailerLoadedAt: payload.trailerLoadedAt
        ? irelandLocalDateTimeToUtc(payload.trailerLoadedAt)
        : null,
      driverOutAt: payload.driverOutAt ? irelandLocalDateTimeToUtc(payload.driverOutAt) : null,
    },
  });
  if (result === "not-found") throw new ShipmentMovementNotFoundError();
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
  const scope = resolveDispatchDateScope(filters.datePreset, new Date(), {
    from: filters.dispatchFrom,
    to: filters.dispatchTo,
  });
  const result = await listShipmentsFromRepository({
    ...filters,
    dispatchFrom: scope.from,
    dispatchTo: scope.to,
  });

  return { ...result, filters };
}

export async function getShipmentsSummary(input: unknown) {
  const filters = shipmentSearchFiltersSchema.parse(input);
  const scope = resolveDispatchDateScope(filters.datePreset, new Date(), {
    from: filters.dispatchFrom,
    to: filters.dispatchTo,
  });
  return getShipmentsSummaryFromRepository({
    ...filters,
    dispatchFrom: scope.from,
    dispatchTo: scope.to,
  });
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
  const filters = shipmentSearchFiltersSchema.parse(input);
  const scope = resolveDispatchDateScope(filters.datePreset, new Date(), {
    from: filters.dispatchFrom,
    to: filters.dispatchTo,
  });
  return { ...filters, dispatchFrom: scope.from, dispatchTo: scope.to };
}

export async function listActiveCarriers() {
  return listActiveCarriersFromRepository();
}

export async function listCarriersForShipmentFilters() {
  return listCarriersForShipmentFiltersFromRepository();
}
