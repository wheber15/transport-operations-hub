import "server-only";

import {
  getById as getShipmentByIdFromRepository,
  list as listShipmentsFromRepository,
  listAvailableDeliveries as listAvailableDeliveriesFromRepository,
  listDeliveries as listDeliveriesFromRepository,
  search as searchShipmentsFromRepository,
} from "@/features/shipments/repositories/shipment-repository";
import type {
  ShipmentActivityRecorder,
  ShipmentSearchFilters,
} from "@/features/shipments/types/shipment";
import {
  shipmentIdSchema,
  shipmentSearchFiltersSchema,
} from "@/features/shipments/validation/shipment-schemas";

export class ShipmentNotFoundError extends Error {
  constructor() {
    super("Shipment not found.");
  }
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
