import type { DachserRow, DachserStage } from "@/features/carrier-exports/domain/dachser-export";

export const carrierExportCalculationVersion = "planned-pallets-750kg-v1";
export const carrierExportRendererVersion = "dachser-xlsx-v1";

export type CarrierExportChange = "ADDED" | "CHANGED" | "UNCHANGED" | "REMOVED";

export type CarrierExportPreviewRow = {
  baselineRowChecksum: string | null;
  blockers: Array<{ code: string; message: string }>;
  changeClassification: CarrierExportChange;
  deliveryId: string;
  linkedOrderCount: number;
  linkedOrderNumbers: string[];
  row: DachserRow;
  rowChecksum: string;
};

export function formatCarrierExportReference(
  goodsIssueDate: string,
  stage: DachserStage,
  sequence: number
) {
  const date = goodsIssueDate.replaceAll("-", "");
  const stageCode = stage === "INITIAL" ? "INI" : stage === "UPDATE" ? "UPD" : "ADD";
  return `AXC-DAC-${stageCode}-${date}-${String(sequence).padStart(3, "0")}`;
}
