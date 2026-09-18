export type VehicleTransactionCostBearer = 'buyer' | 'seller' | 'split';

export type VehicleTransactionRuleSource = {
  id: string;
  label: string;
  url: string;
  verifiedAt: string;
};

export type ChileVehicleTransactionRuleSet = {
  id: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  transferTaxRate: number;
  civilOfficerProcedureFeeClp: number;
  motorVehicleRegistryFeeClp: number;
  sources: readonly VehicleTransactionRuleSource[];
};

export type ChileVehicleTransactionEstimateInput = {
  salePriceClp: number;
  siiCurrentMarketValueClp?: number;
  costBearer?: VehicleTransactionCostBearer;
  ruleSet?: ChileVehicleTransactionRuleSet;
};

export type ChileVehicleTransactionEstimate = {
  ruleSetId: string;
  salePriceClp: number;
  taxableBaseClp: number;
  transferTaxClp: number;
  civilOfficerProcedureFeeClp: number;
  motorVehicleRegistryFeeClp: number;
  totalTransferCostsClp: number;
  buyerEstimatedOutlayClp: number;
  sellerEstimatedNetClp: number;
  costBearer: VehicleTransactionCostBearer;
};

/**
 * Versioned 2026 Chile baseline for a consensual vehicle transfer before a civil officer.
 * Values live here instead of UI code so future legal/fee changes can be introduced by
 * adding a new rule set without rebuilding the selling experience.
 */
export const CHILE_VEHICLE_TRANSACTION_RULES_2026: ChileVehicleTransactionRuleSet = {
  id: 'cl-vehicle-transfer-2026-01',
  effectiveFrom: '2026-01-01',
  transferTaxRate: 0.015,
  civilOfficerProcedureFeeClp: 9_610,
  motorVehicleRegistryFeeClp: 39_240,
  sources: [
    {
      id: 'sii-circular-66-2020',
      label: 'SII · Circular 66/2020',
      url: 'https://www.sii.cl/normativa_legislacion/circulares/2020/circu66.pdf',
      verifiedAt: '2026-09-18',
    },
    {
      id: 'chileatiende-transferencia-oficial-civil',
      label: 'ChileAtiende · Transferencia ante oficial civil',
      url: 'https://www.chileatiende.gob.cl/fichas/3343',
      verifiedAt: '2026-09-18',
    },
  ],
};

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function estimateChileVehicleTransaction(
  input: ChileVehicleTransactionEstimateInput,
): ChileVehicleTransactionEstimate {
  const ruleSet = input.ruleSet ?? CHILE_VEHICLE_TRANSACTION_RULES_2026;
  const salePriceClp = nonNegativeInteger(input.salePriceClp);
  const fiscalReferenceClp = nonNegativeInteger(input.siiCurrentMarketValueClp ?? 0);
  const taxableBaseClp = Math.max(salePriceClp, fiscalReferenceClp);
  const transferTaxClp = nonNegativeInteger(taxableBaseClp * ruleSet.transferTaxRate);
  const civilOfficerProcedureFeeClp = nonNegativeInteger(ruleSet.civilOfficerProcedureFeeClp);
  const motorVehicleRegistryFeeClp = nonNegativeInteger(ruleSet.motorVehicleRegistryFeeClp);
  const totalTransferCostsClp =
    transferTaxClp + civilOfficerProcedureFeeClp + motorVehicleRegistryFeeClp;
  const costBearer = input.costBearer ?? 'buyer';

  const sellerCostClp =
    costBearer === 'seller'
      ? totalTransferCostsClp
      : costBearer === 'split'
        ? Math.round(totalTransferCostsClp / 2)
        : 0;
  const buyerCostClp = totalTransferCostsClp - sellerCostClp;

  return {
    ruleSetId: ruleSet.id,
    salePriceClp,
    taxableBaseClp,
    transferTaxClp,
    civilOfficerProcedureFeeClp,
    motorVehicleRegistryFeeClp,
    totalTransferCostsClp,
    buyerEstimatedOutlayClp: salePriceClp + buyerCostClp,
    sellerEstimatedNetClp: Math.max(0, salePriceClp - sellerCostClp),
    costBearer,
  };
}
