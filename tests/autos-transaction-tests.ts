import {
  CHILE_VEHICLE_TRANSACTION_RULES_2026,
  estimateChileVehicleTransaction,
} from '../src/autos/chileVehicleTransaction.js';
import { validateVehicleOfferAdjustment } from '../src/autos/autosSellerModel.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const buyerPays = estimateChileVehicleTransaction({
  salePriceClp: 18_990_000,
  siiCurrentMarketValueClp: 15_000_000,
  costBearer: 'buyer',
});

assert(buyerPays.taxableBaseClp === 18_990_000, 'Sale price should be the taxable base when it exceeds the SII reference.');
assert(buyerPays.transferTaxClp === 284_850, 'Transfer tax should apply the versioned 1.5% rule.');
assert(buyerPays.civilOfficerProcedureFeeClp === 9_610, '2026 civil officer procedure fee must stay versioned.');
assert(buyerPays.motorVehicleRegistryFeeClp === 39_240, '2026 registry fee must stay versioned.');
assert(buyerPays.totalTransferCostsClp === 333_700, 'Transfer cost total should be deterministic.');
assert(buyerPays.sellerEstimatedNetClp === 18_990_000, 'Seller net should not deduct transfer costs when buyer pays them.');
assert(buyerPays.buyerEstimatedOutlayClp === 19_323_700, 'Buyer outlay should include transfer costs.');

const siiFloor = estimateChileVehicleTransaction({
  salePriceClp: 10_000_000,
  siiCurrentMarketValueClp: 12_000_000,
  costBearer: 'seller',
});

assert(siiFloor.taxableBaseClp === 12_000_000, 'SII current market value must act as the minimum taxable base when higher.');
assert(siiFloor.transferTaxClp === 180_000, 'Tax should use the higher legal base.');
assert(siiFloor.sellerEstimatedNetClp === 9_771_150, 'Seller-paid scenario should deduct the full transfer estimate.');
assert(CHILE_VEHICLE_TRANSACTION_RULES_2026.sources.length >= 2, 'Versioned rules must retain official-source provenance.');

const evidencedAdjustment = validateVehicleOfferAdjustment({
  id: 'adjustment-1',
  offerId: 'offer-1',
  previousAmountClp: 11_450_000,
  revisedAmountClp: 11_250_000,
  reason: 'undisclosed_damage',
  explanation: 'Daño de parachoques no visible en las fotos iniciales.',
  evidenceRefs: ['inspection-photo-1'],
  createdAt: '2026-09-18T12:00:00.000Z',
});
assert(evidencedAdjustment.valid, 'Documented downward adjustment should be valid.');

const unsupportedAdjustment = validateVehicleOfferAdjustment({
  id: 'adjustment-2',
  offerId: 'offer-1',
  previousAmountClp: 11_450_000,
  revisedAmountClp: 10_900_000,
  reason: 'other_verified_difference',
  explanation: 'Ajuste en terreno.',
  evidenceRefs: [],
  createdAt: '2026-09-18T12:05:00.000Z',
});
assert(!unsupportedAdjustment.valid, 'Downward adjustment without evidence must be rejected.');

console.log('PASS: Autos Chile transaction and dealer adjustment rules');
