export const palletWeightMaximumKg = "1000.000";
export const estimatedKgPerPallet = "750.000";

const kilogramPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;

export type PalletWeightSummary = {
  actualPalletWeightKg: string | null;
  palletCount: number;
  varianceKg: string | null;
  status: "awaitingActual" | "captured";
};

function toMilligrams(value: string) {
  if (!kilogramPattern.test(value)) return null;
  const [whole, fractional = ""] = value.split(".");
  return Number.parseInt(whole, 10) * 1000 + Number.parseInt(fractional.padEnd(3, "0"), 10);
}

function formatMilligrams(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / 1000)}.${(absolute % 1000).toString().padStart(3, "0")}`;
}

export function isValidPalletWeight(value: string) {
  const weight = toMilligrams(value);
  return weight !== null && weight > 0 && weight <= toMilligrams(palletWeightMaximumKg)!;
}

export function estimatePalletCount(sapGrossWeightKg: string | null) {
  const sapWeight = sapGrossWeightKg ? toMilligrams(sapGrossWeightKg) : null;
  const planningWeight = toMilligrams(estimatedKgPerPallet)!;
  return sapWeight === null || sapWeight <= 0 ? null : Math.ceil(sapWeight / planningWeight);
}

export function calculatePalletWeightSummary(
  palletWeightsKg: string[],
  sapGrossWeightKg: string | null
): PalletWeightSummary {
  if (palletWeightsKg.length === 0) {
    return {
      palletCount: 0,
      actualPalletWeightKg: null,
      varianceKg: null,
      status: "awaitingActual",
    };
  }

  const total = palletWeightsKg.reduce((sum, value) => sum + (toMilligrams(value) ?? 0), 0);
  const actualPalletWeightKg = formatMilligrams(total);
  const sapWeight = sapGrossWeightKg ? toMilligrams(sapGrossWeightKg) : null;

  if (sapWeight === null) {
    return {
      palletCount: palletWeightsKg.length,
      actualPalletWeightKg,
      varianceKg: null,
      status: "captured",
    };
  }

  const variance = total - sapWeight;
  return {
    palletCount: palletWeightsKg.length,
    actualPalletWeightKg,
    varianceKg: formatMilligrams(variance),
    status: "captured",
  };
}
