import {
  mergeVehicleIdentitySnapshots,
  type ChileVehicleIdentitySnapshot,
} from './chileVehicleData.js';
import {
  estimateChileVehicleTransaction,
  type ChileVehicleTransactionEstimate,
  type VehicleTransactionCostBearer,
} from './chileVehicleTransaction.js';

export type VehicleFiscalValuationState =
  | 'verified'
  | 'not_resolved';

export type VehicleSalePreparationProjection = {
  vehicle: ChileVehicleIdentitySnapshot | null;
  fiscalValuation: {
    state: VehicleFiscalValuationState;
    valueClp?: number;
    sourceRef?: string;
  };
  transactionEstimate: ChileVehicleTransactionEstimate;
  estimateConfidence: 'official_floor_applied' | 'minimum_without_fiscal_value';
  userActionRequiredNow: boolean;
  userMessageKey:
    | 'autos.sale.costs.official_floor_applied'
    | 'autos.sale.costs.minimum_pending_fiscal_value';
};

export type VehicleSalePreparationInput = {
  snapshots: readonly ChileVehicleIdentitySnapshot[];
  salePriceClp: number;
  costBearer?: VehicleTransactionCostBearer;
};

/**
 * Sale preparation must stay useful even when the official SII version has not yet
 * been uniquely resolved. Missing public data lowers confidence; it does not force
 * the person through another form before they can compare selling options.
 */
export function buildVehicleSalePreparation(
  input: VehicleSalePreparationInput,
): VehicleSalePreparationProjection {
  const vehicle = mergeVehicleIdentitySnapshots(input.snapshots);
  const fiscalFact = vehicle?.fiscalValueClp;
  const fiscalValueClp = fiscalFact?.value;

  const transactionEstimate = estimateChileVehicleTransaction({
    salePriceClp: input.salePriceClp,
    ...(fiscalValueClp !== undefined ? { siiCurrentMarketValueClp: fiscalValueClp } : {}),
    ...(input.costBearer ? { costBearer: input.costBearer } : {}),
  });

  if (fiscalFact && fiscalValueClp !== undefined) {
    return {
      vehicle,
      fiscalValuation: {
        state: 'verified',
        valueClp: fiscalValueClp,
        ...(fiscalFact.sourceRef ? { sourceRef: fiscalFact.sourceRef } : {}),
      },
      transactionEstimate,
      estimateConfidence: 'official_floor_applied',
      userActionRequiredNow: false,
      userMessageKey: 'autos.sale.costs.official_floor_applied',
    };
  }

  return {
    vehicle,
    fiscalValuation: { state: 'not_resolved' },
    transactionEstimate,
    estimateConfidence: 'minimum_without_fiscal_value',
    userActionRequiredNow: false,
    userMessageKey: 'autos.sale.costs.minimum_pending_fiscal_value',
  };
}
