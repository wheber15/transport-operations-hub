import "server-only";

import { randomUUID } from "node:crypto";

import {
  CarrierExportArtifactFormat,
  CarrierExportArtifactStatus,
  CarrierExportStage,
  CarrierExportStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

import type { DachserRow } from "@/features/carrier-exports/domain/dachser-export";

export class CarrierExportDuplicateError extends Error {}
export class CarrierExportStateError extends Error {}

const activeRunStatuses = [
  CarrierExportStatus.PENDING,
  CarrierExportStatus.GENERATED,
  CarrierExportStatus.SENT,
];
const completedRunStatuses = [CarrierExportStatus.GENERATED, CarrierExportStatus.SENT];

const runHistorySelect = {
  id: true,
  reference: true,
  carrierId: true,
  goodsIssueDate: true,
  stage: true,
  sequence: true,
  status: true,
  sentAt: true,
  filename: true,
  rowCount: true,
  distinctDeliveryCount: true,
  totalWeightKg: true,
  totalPallets: true,
  addedCount: true,
  changedCount: true,
  removedCount: true,
  unchangedCount: true,
  datasetChecksum: true,
  generatedByDisplayName: true,
  generatedAt: true,
  createdAt: true,
  baselineRun: { select: { id: true, reference: true } },
  artifacts: {
    select: {
      format: true,
      status: true,
      filename: true,
    },
  },
} satisfies Prisma.CarrierExportRunSelect;

export type CarrierExportHistoryItem = Prisma.CarrierExportRunGetPayload<{
  select: typeof runHistorySelect;
}>;

export type CarrierExportSourceDelivery = {
  deliveryId: string;
  linkedOrderCount: number;
  linkedOrderNumbers: string[];
  blockers: Array<{
    code: string;
    message: string;
    orderId?: string;
    orderNumber?: string;
    orderUnavailable?: boolean;
  }>;
  row: DachserRow;
};

export type CarrierExportSourceDeliveries = {
  excluded: {
    inactiveDeliveries: number;
    inactiveLinkedOrders: number;
    mixedLinkedOrderStates: number;
  };
  excludedRecords: Array<{
    deliveryNumber: string;
    orderId?: string;
    orderNumber?: string;
    reason: "INACTIVE_DELIVERY" | "INACTIVE_LINKED_ORDER";
  }>;
  sources: CarrierExportSourceDelivery[];
};

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function withSerializableRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSerializationFailure(error) || attempt === attempts - 1) throw error;
    }
  }
  throw lastError;
}

export async function listActiveCarriers() {
  return prisma.carrier.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true, carrierNumber: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function findActiveCarrier(carrierId: string) {
  return prisma.carrier.findFirst({
    where: { id: carrierId, active: true, deletedAt: null },
    select: { id: true, carrierNumber: true, name: true },
  });
}

export async function listSourceDeliveries(
  goodsIssueDate: string
): Promise<CarrierExportSourceDeliveries> {
  const deliveries = await prisma.delivery.findMany({
    where: {
      OR: [
        { order: { is: { goodsIssueDate: date(goodsIssueDate) } } },
        { orderLinks: { some: { order: { is: { goodsIssueDate: date(goodsIssueDate) } } } } },
      ],
    },
    select: {
      id: true,
      deliveryNumber: true,
      deletedAt: true,
      orderLinks: {
        select: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              shipToNumber: true,
              shipToName2: true,
              shipToStreet: true,
              shipToCity: true,
              shipToPostalCode: true,
              shipToRegion: true,
              grossWeightKg: true,
              goodsIssueDate: true,
              deletedAt: true,
              customer: { select: { id: true, name: true, deletedAt: true } },
            },
          },
        },
      },
    },
    orderBy: [{ deliveryNumber: "asc" }, { id: "asc" }],
  });

  const excluded = { inactiveDeliveries: 0, inactiveLinkedOrders: 0, mixedLinkedOrderStates: 0 };
  const excludedRecords: CarrierExportSourceDeliveries["excludedRecords"] = [];
  const sources: CarrierExportSourceDelivery[] = [];
  for (const delivery of deliveries) {
    const orders = [
      ...new Map(delivery.orderLinks.map((link) => [link.order.id, link.order])).values(),
    ];
    if (delivery.deletedAt) {
      excluded.inactiveDeliveries += 1;
      excludedRecords.push({
        deliveryNumber: delivery.deliveryNumber,
        reason: "INACTIVE_DELIVERY",
      });
      continue;
    }
    const inactiveOrders = orders.filter((order) => order.deletedAt !== null);
    if (inactiveOrders.length) {
      excluded.inactiveLinkedOrders += 1;
      if (inactiveOrders.length !== orders.length) excluded.mixedLinkedOrderStates += 1;
      for (const order of inactiveOrders)
        excludedRecords.push({
          deliveryNumber: delivery.deliveryNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: "INACTIVE_LINKED_ORDER",
        });
      continue;
    }
    const values = <T>(select: (order: (typeof orders)[number]) => T) =>
      new Set(orders.map(select));
    const blockers: CarrierExportSourceDelivery["blockers"] = [];
    const linkedOrderNumbers = orders.map((order) => order.orderNumber).sort();
    const label = linkedOrderNumbers.length ? ` (${linkedOrderNumbers.join(", ")})` : "";
    if (!orders.length)
      blockers.push({ code: "MISSING_LINKED_ORDERS", message: "Delivery has no linked Orders." });
    if (orders.some((order) => !order.grossWeightKg || order.grossWeightKg.lte(0)))
      blockers.push({
        code: "INVALID_LINKED_WEIGHT",
        message: `A linked Order has no positive SAP gross weight${label}.`,
        orderId: orders.find((order) => !order.grossWeightKg || order.grossWeightKg.lte(0))?.id,
        orderNumber: orders.find((order) => !order.grossWeightKg || order.grossWeightKg.lte(0))
          ?.orderNumber,
      });
    const conflicts = [
      [
        "CONFLICTING_GOODS_ISSUE_DATE",
        values((order) => order.goodsIssueDate?.toISOString().slice(0, 10) ?? null),
      ],
      ["CONFLICTING_SHIP_TO", values((order) => order.shipToNumber)],
      ["CONFLICTING_SOLD_TO", values((order) => order.customer.id)],
      [
        "CONFLICTING_DESTINATION",
        values((order) =>
          JSON.stringify([
            order.shipToName2,
            order.shipToStreet,
            order.shipToCity,
            order.shipToPostalCode,
            order.shipToRegion,
          ])
        ),
      ],
    ] as const;
    for (const [code, conflictValues] of conflicts)
      if (conflictValues.size !== 1)
        blockers.push({ code, message: `Linked Orders disagree on required export data${label}.` });
    const totalWeight = orders.reduce(
      (sum, order) => sum.plus(order.grossWeightKg ?? 0),
      new Prisma.Decimal(0)
    );
    const primary = orders[0];
    sources.push({
      deliveryId: delivery.id,
      linkedOrderCount: orders.length,
      linkedOrderNumbers,
      blockers,
      row: {
        shipmentNumber: null,
        salesOrderNumber: linkedOrderNumbers.join(", ") || null,
        deliveryNumber: delivery.deliveryNumber,
        shipToParty: blockers.some((blocker) => blocker.code === "CONFLICTING_SHIP_TO")
          ? null
          : (primary?.shipToNumber ?? null),
        soldToName1: blockers.some((blocker) => blocker.code === "CONFLICTING_SOLD_TO")
          ? null
          : primary?.customer.deletedAt === null
            ? primary.customer.name
            : null,
        shipToName2: blockers.some((blocker) => blocker.code === "CONFLICTING_DESTINATION")
          ? null
          : (primary?.shipToName2 ?? null),
        street: blockers.some((blocker) => blocker.code === "CONFLICTING_DESTINATION")
          ? null
          : (primary?.shipToStreet ?? null),
        city: blockers.some((blocker) => blocker.code === "CONFLICTING_DESTINATION")
          ? null
          : (primary?.shipToCity ?? null),
        postalCode: blockers.some((blocker) => blocker.code === "CONFLICTING_DESTINATION")
          ? null
          : (primary?.shipToPostalCode ?? null),
        region: blockers.some((blocker) => blocker.code === "CONFLICTING_DESTINATION")
          ? null
          : (primary?.shipToRegion ?? null),
        totalWeightKg: blockers.some((blocker) => blocker.code === "INVALID_LINKED_WEIGHT")
          ? null
          : totalWeight.toFixed(3),
        palletUnit: null,
        goodsIssueDate: blockers.some((blocker) => blocker.code === "CONFLICTING_GOODS_ISSUE_DATE")
          ? null
          : (primary?.goodsIssueDate?.toISOString().slice(0, 10) ?? null),
        carrierId: null,
      },
    });
  }
  return { excluded, excludedRecords, sources };
}

export async function getBaselineRun(input: {
  baselineRunId?: string;
  carrierId: string;
  goodsIssueDate: string;
  stage: CarrierExportStage;
}) {
  if (input.stage === CarrierExportStage.INITIAL) return null;
  const baselineStatuses =
    input.stage === CarrierExportStage.ADDITION ? [CarrierExportStatus.SENT] : completedRunStatuses;
  const where = {
    carrierId: input.carrierId,
    goodsIssueDate: date(input.goodsIssueDate),
    status: { in: baselineStatuses },
  } satisfies Prisma.CarrierExportRunWhereInput;
  const baseline = input.baselineRunId
    ? await prisma.carrierExportRun.findFirst({
        where: {
          ...where,
          id: input.baselineRunId,
          stage: { in: [CarrierExportStage.INITIAL, CarrierExportStage.UPDATE] },
        },
        select: {
          id: true,
          reference: true,
          datasetChecksum: true,
          rows: { select: { deliveryNumber: true, rowChecksum: true } },
        },
      })
    : await prisma.carrierExportRun.findFirst({
        where: {
          ...where,
          stage: { in: [CarrierExportStage.INITIAL, CarrierExportStage.UPDATE] },
        },
        orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          reference: true,
          datasetChecksum: true,
          rows: { select: { deliveryNumber: true, rowChecksum: true } },
        },
      });
  if (!baseline) throw new CarrierExportStateError();
  return baseline;
}

export async function getCumulativeSentDeliveryNumbers(carrierId: string, goodsIssueDate: string) {
  const rows = await prisma.carrierExportRow.findMany({
    where: {
      exportRun: {
        is: { carrierId, goodsIssueDate: date(goodsIssueDate), status: CarrierExportStatus.SENT },
      },
    },
    select: { deliveryNumber: true },
  });
  return new Set(rows.map((row) => row.deliveryNumber));
}

export async function createPendingExport(input: {
  actor: { id: string; displayName: string };
  baselineRunId: string | null;
  carrierId: string;
  changeCounts: { added: number; changed: number; removed: number; unchanged: number };
  datasetChecksum: string;
  goodsIssueDate: string;
  rows: Array<{
    deliveryId: string;
    deliveryNumber: string;
    normalizedPayload: Prisma.InputJsonValue;
    rowChecksum: string;
    changeClassification: "ADDED" | "CHANGED" | "UNCHANGED" | "REMOVED";
    baselineRowChecksum: string | null;
  }>;
  stage: CarrierExportStage;
  totalPallets: number;
  totalWeightKg: string;
}) {
  const fingerprint = `${input.carrierId}:${input.goodsIssueDate}:${input.stage}`;
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${fingerprint}))`;
        const isInitial = input.stage === CarrierExportStage.INITIAL;
        const existing = await tx.carrierExportRun.findFirst({
          where: {
            carrierId: input.carrierId,
            goodsIssueDate: date(input.goodsIssueDate),
            stage: input.stage,
            status: { in: activeRunStatuses },
            datasetChecksum: input.datasetChecksum,
            baselineRunId: input.baselineRunId,
          },
          select: { id: true },
        });
        if (existing) throw new CarrierExportDuplicateError();

        if (isInitial) {
          const priorInitial = await tx.carrierExportRun.findFirst({
            where: {
              carrierId: input.carrierId,
              goodsIssueDate: date(input.goodsIssueDate),
              stage: CarrierExportStage.INITIAL,
              status: { in: activeRunStatuses },
            },
            select: { id: true },
          });
          if (priorInitial) throw new CarrierExportDuplicateError();
        }

        const sequence = isInitial
          ? 0
          : (
              await tx.carrierExportSequence.upsert({
                where: {
                  carrierId_goodsIssueDate_stage: {
                    carrierId: input.carrierId,
                    goodsIssueDate: date(input.goodsIssueDate),
                    stage: input.stage,
                  },
                },
                create: {
                  carrierId: input.carrierId,
                  goodsIssueDate: date(input.goodsIssueDate),
                  stage: input.stage,
                  lastSequence: 1,
                },
                update: { lastSequence: { increment: 1 } },
                select: { lastSequence: true },
              })
            ).lastSequence;

        const run = await tx.carrierExportRun.create({
          data: {
            reference: `pending-${randomUUID()}`,
            carrierId: input.carrierId,
            goodsIssueDate: date(input.goodsIssueDate),
            stage: input.stage,
            sequence,
            status: CarrierExportStatus.PENDING,
            baselineRunId: input.baselineRunId,
            rowCount: input.rows.length,
            distinctDeliveryCount: new Set(input.rows.map((row) => row.deliveryNumber)).size,
            totalWeightKg: new Prisma.Decimal(input.totalWeightKg),
            totalPallets: input.totalPallets,
            addedCount: input.changeCounts.added,
            changedCount: input.changeCounts.changed,
            removedCount: input.changeCounts.removed,
            unchangedCount: input.changeCounts.unchanged,
            datasetChecksum: input.datasetChecksum,
            calculationVersion: "planned-pallets-750kg-v1",
            generatedById: input.actor.id,
            generatedByDisplayName: input.actor.displayName,
            rows: {
              createMany: {
                data: input.rows.map((row, index) => ({
                  deliveryId: row.deliveryId,
                  deliveryNumber: row.deliveryNumber,
                  rowSequence: index + 1,
                  normalizedPayload: row.normalizedPayload,
                  rowChecksum: row.rowChecksum,
                  changeClassification: row.changeClassification,
                  baselineRowChecksum: row.baselineRowChecksum,
                })),
              },
            },
            artifacts: { create: { format: CarrierExportArtifactFormat.XLSX } },
          },
          select: { id: true, sequence: true },
        });
        return run;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

export async function completeExport(input: {
  actorId: string;
  artifact: { byteSize: bigint; checksumSha256: string; fileName: string; storageKey: string };
  exportRunId: string;
  reference: string;
}) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.carrierExportRun.update({
      where: { id: input.exportRunId },
      data: {
        reference: input.reference,
        filename: input.artifact.fileName,
        status: CarrierExportStatus.GENERATED,
        generatedAt: new Date(),
      },
      select: { id: true, reference: true },
    });
    const artifact = await tx.carrierExportArtifact.updateMany({
      where: { exportRunId: input.exportRunId, status: CarrierExportArtifactStatus.PENDING },
      data: {
        status: CarrierExportArtifactStatus.COMPLETED,
        storageKey: input.artifact.storageKey,
        filename: input.artifact.fileName,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        byteSize: input.artifact.byteSize,
        checksumSha256: input.artifact.checksumSha256,
        generatedAt: new Date(),
      },
    });
    if (artifact.count !== 1) throw new CarrierExportStateError();
    await tx.activity.create({
      data: {
        entityType: "CarrierExportRun",
        entityId: run.id,
        action: "carrier_export_generated",
        description: `Carrier export ${run.reference} generated.`,
        metadata: { format: "XLSX" },
        actorId: input.actorId,
        createdById: input.actorId,
        updatedById: input.actorId,
      },
    });
    return run;
  });
}

export async function failExport(exportRunId: string, actorId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.carrierExportRun.updateMany({
      where: { id: exportRunId, status: CarrierExportStatus.PENDING },
      data: {
        status: CarrierExportStatus.FAILED,
        failureCode: "CARRIER_EXPORT_GENERATION_FAILED",
        failureMessage: "The carrier export could not be generated safely.",
      },
    });
    await tx.carrierExportArtifact.updateMany({
      where: { exportRunId, status: CarrierExportArtifactStatus.PENDING },
      data: {
        status: CarrierExportArtifactStatus.FAILED,
        failureCode: "CARRIER_EXPORT_GENERATION_FAILED",
        failureMessage: "The carrier export could not be generated safely.",
      },
    });
    await tx.activity.create({
      data: {
        entityType: "CarrierExportRun",
        entityId: exportRunId,
        action: "carrier_export_failed",
        description: "Carrier export generation failed safely.",
        metadata: { failureCode: "CARRIER_EXPORT_GENERATION_FAILED" },
        actorId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
  });
}

export async function listHistory(carrierId?: string, goodsIssueDate?: string) {
  return prisma.carrierExportRun.findMany({
    where: {
      ...(carrierId ? { carrierId } : {}),
      ...(goodsIssueDate ? { goodsIssueDate: date(goodsIssueDate) } : {}),
    },
    select: runHistorySelect,
    orderBy: [{ goodsIssueDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}

export async function getCompletedArtifact(exportRunId: string) {
  return prisma.carrierExportArtifact.findFirst({
    where: {
      exportRunId,
      status: CarrierExportArtifactStatus.COMPLETED,
      exportRun: { is: { status: { in: completedRunStatuses } } },
    },
    select: {
      storageKey: true,
      filename: true,
      contentType: true,
      byteSize: true,
      checksumSha256: true,
      exportRun: { select: { id: true, reference: true } },
    },
  });
}

export async function markSent(exportRunId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.carrierExportRun.updateMany({
      where: { id: exportRunId, status: CarrierExportStatus.GENERATED },
      data: { status: CarrierExportStatus.SENT, sentAt: new Date(), sentById: actorId },
    });
    if (updated.count !== 1) return null;
    await tx.activity.create({
      data: {
        entityType: "CarrierExportRun",
        entityId: exportRunId,
        action: "carrier_export_marked_sent",
        description: "Carrier export marked as sent.",
        metadata: {},
        actorId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    return true;
  });
}

export async function recordArtifactDownload(exportRunId: string, actorId: string) {
  await prisma.activity.create({
    data: {
      entityType: "CarrierExportRun",
      entityId: exportRunId,
      action: "carrier_export_artifact_downloaded",
      description: "Carrier export artifact downloaded.",
      metadata: { format: "XLSX" },
      actorId,
      createdById: actorId,
      updatedById: actorId,
    },
  });
}
