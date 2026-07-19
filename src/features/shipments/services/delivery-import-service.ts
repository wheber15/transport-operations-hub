import "server-only";

import { canManageDeliveryImports } from "@/features/auth/domain/roles";
import {
  normalizeCommittedDeliveryNumbers,
  normalizePastedDeliveryNumbers,
} from "@/features/shipments/lib/delivery-import-normalization";
import {
  commitEligibleDeliveryImports,
  findActiveShipment,
  findDeliveriesByNumbers,
  type DeliveryImportRecord,
} from "@/features/shipments/repositories/delivery-import-repository";
import type {
  DeliveryImportClassification,
  DeliveryImportCommit,
  DeliveryImportPreview,
  DeliveryImportResult,
} from "@/features/shipments/types/shipment";
import {
  deliveryImportCommitSchema,
  deliveryImportPreviewSchema,
  shipmentIdSchema,
} from "@/features/shipments/validation/shipment-schemas";

export class DeliveryImportForbiddenError extends Error {}
export class DeliveryImportShipmentNotFoundError extends Error {}
export { DeliveryImportValidationError } from "@/features/shipments/lib/delivery-import-normalization";

type DeliveryImportActor = { id: string; role: string | null };

function requireDeliveryImportRole(actor: DeliveryImportActor) {
  if (!canManageDeliveryImports(actor.role)) throw new DeliveryImportForbiddenError();
}

function classifyDelivery(
  deliveryNumber: string,
  targetShipmentNumber: string,
  record: DeliveryImportRecord | undefined,
  assignedInCommit = false
): DeliveryImportResult {
  const base = {
    deliveryNumber,
    orderNumber: record?.orderNumber ?? null,
    customerName: record?.customerName ?? null,
    currentShipmentNumber: record?.shipmentNumber ?? null,
  };

  if (!record) {
    return {
      ...base,
      classification: "notFound",
      message:
        "No delivery matches this SAP Delivery Number. Remove column headers or non-delivery text.",
    };
  }
  if (record.deliveryDeletedAt) {
    return {
      ...base,
      classification: "unavailableDelivery",
      message: "This delivery is unavailable.",
    };
  }
  if (record.orderDeletedAt) {
    return {
      ...base,
      classification: "unavailableOrder",
      message: "The related order is unavailable.",
    };
  }
  if (record.shipmentNumber === targetShipmentNumber) {
    return {
      ...base,
      classification: assignedInCommit ? "eligible" : "alreadyAssignedToTarget",
      message: assignedInCommit
        ? "Delivery assigned to this shipment."
        : "Delivery is already assigned to this shipment.",
    };
  }
  if (record.shipmentNumber) {
    return {
      ...base,
      classification: "assignedToAnotherShipment",
      message: "Delivery is assigned to another shipment.",
    };
  }
  return { ...base, classification: "eligible", message: "Delivery is ready to assign." };
}

function getSummary(results: DeliveryImportResult[]) {
  const count = (classification: DeliveryImportClassification) =>
    results.filter((result) => result.classification === classification).length;
  const assignedCount = results.filter(
    (result) => result.message === "Delivery assigned to this shipment."
  ).length;
  const alreadyAssignedToTargetCount = count("alreadyAssignedToTarget");
  const assignedElsewhereCount = count("assignedToAnotherShipment");
  const notFoundCount = count("notFound");
  const unavailableDeliveryCount = count("unavailableDelivery");
  const unavailableOrderCount = count("unavailableOrder");
  const unavailableCount = unavailableDeliveryCount + unavailableOrderCount;

  return {
    assignedCount,
    alreadyAssignedToTargetCount,
    assignedElsewhereCount,
    notFoundCount,
    unavailableDeliveryCount,
    unavailableOrderCount,
    unavailableCount,
    skippedCount: results.length - assignedCount,
  };
}

async function getTargetShipmentNumber(shipmentId: string) {
  const shipment = await findActiveShipment(shipmentId);
  if (!shipment) throw new DeliveryImportShipmentNotFoundError();
  return shipment.shipmentNumber;
}

export async function previewDeliveryImport(
  actor: DeliveryImportActor,
  shipmentIdInput: unknown,
  input: unknown
): Promise<DeliveryImportPreview> {
  requireDeliveryImportRole(actor);
  const shipmentId = shipmentIdSchema.parse(shipmentIdInput);
  const { deliveryNumbers } = deliveryImportPreviewSchema.parse(input);
  const normalized = normalizePastedDeliveryNumbers(deliveryNumbers);
  const targetShipmentNumber = await getTargetShipmentNumber(shipmentId);
  const records = await findDeliveriesByNumbers(normalized.uniqueNumbers);

  return {
    requestedCount: normalized.requestedCount,
    uniqueCount: normalized.uniqueNumbers.length,
    duplicateInputCount: normalized.duplicates.reduce(
      (total, duplicate) => total + duplicate.occurrences - 1,
      0
    ),
    duplicates: normalized.duplicates,
    results: normalized.uniqueNumbers.map((deliveryNumber) =>
      classifyDelivery(deliveryNumber, targetShipmentNumber, records.get(deliveryNumber))
    ),
  };
}

export async function commitDeliveryImport(
  actor: DeliveryImportActor,
  shipmentIdInput: unknown,
  input: unknown
): Promise<DeliveryImportCommit> {
  requireDeliveryImportRole(actor);
  const shipmentId = shipmentIdSchema.parse(shipmentIdInput);
  const { deliveryNumbers } = deliveryImportCommitSchema.parse(input);
  const normalized = normalizeCommittedDeliveryNumbers(deliveryNumbers);
  const committed = await commitEligibleDeliveryImports({
    actorId: actor.id,
    deliveryNumbers: normalized.uniqueNumbers,
    shipmentId,
  });
  if (!committed) throw new DeliveryImportShipmentNotFoundError();

  const results = normalized.uniqueNumbers.map((deliveryNumber) =>
    classifyDelivery(
      deliveryNumber,
      committed.shipmentNumber,
      committed.records.get(deliveryNumber),
      committed.assignedDeliveryNumbers.has(deliveryNumber)
    )
  );

  return {
    requestedCount: normalized.requestedCount,
    uniqueCount: normalized.uniqueNumbers.length,
    duplicateInputCount: normalized.duplicates.reduce(
      (total, duplicate) => total + duplicate.occurrences - 1,
      0
    ),
    duplicates: normalized.duplicates,
    results,
    ...getSummary(results),
  };
}
