import {
  CHILE_VEHICLE_TRANSACTION_RULES_2026,
  estimateChileVehicleTransaction,
} from '../src/autos/chileVehicleTransaction.js';

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

console.log('PASS: Autos Chile transaction estimate rules');
