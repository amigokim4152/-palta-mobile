import {
  addPOSCatalogItem,
  appendPOSCustomLine,
  createPOSCustomLine,
  decrementPOSLine,
  summarizePOSDraftCart,
} from '../src/commerce/posDraftCart.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const custom = createPOSCustomLine({
  id: 'custom:1',
  amountMinor: 12990,
});
assert(custom.kind === 'custom', 'quick-sale line must be custom');
assert(custom.title === 'Venta rápida', 'quick-sale line should use the default title');
assert(custom.quantity === 1, 'quick-sale line must start at quantity 1');
assert(custom.lineAmountMinor === 12990, 'quick-sale line must preserve the requested amount');

let lines = appendPOSCustomLine([], custom);
lines = addPOSCatalogItem(lines, {
  id: 'shirt-black-m',
  title: 'Polera negra M',
  unitAmountMinor: 9990,
  productId: 'product:shirt-black',
  variantId: 'variant:shirt-black-m',
});
lines = addPOSCatalogItem(lines, {
  id: 'shirt-black-m',
  title: 'Polera negra M',
  unitAmountMinor: 9990,
  productId: 'product:shirt-black',
  variantId: 'variant:shirt-black-m',
});

const catalogLine = lines.find((line) => line.id === 'catalog:shirt-black-m');
assert(catalogLine?.quantity === 2, 'repeated catalog taps must increase quantity');
assert(catalogLine?.lineAmountMinor === 19980, 'catalog line amount must be recalculated');

let summary = summarizePOSDraftCart(lines);
assert(summary.lineCount === 2, 'cart should contain one custom and one catalog line');
assert(summary.itemCount === 3, 'cart item count must include line quantities');
assert(summary.totalAmountMinor === 32970, 'cart total must be canonical integer CLP amount');

lines = decrementPOSLine(lines, 'catalog:shirt-black-m');
summary = summarizePOSDraftCart(lines);
assert(summary.itemCount === 2, 'decrement must reduce item count');
assert(summary.totalAmountMinor === 22980, 'decrement must reduce total exactly once');

lines = decrementPOSLine(lines, 'catalog:shirt-black-m');
assert(!lines.some((line) => line.id === 'catalog:shirt-black-m'), 'quantity 1 decrement must remove the line');

let rejectedZero = false;
try {
  createPOSCustomLine({ id: 'custom:zero', amountMinor: 0 });
} catch {
  rejectedZero = true;
}
assert(rejectedZero, 'zero-value quick sale must be rejected');

console.log('pos-draft-cart-tests: PASS');
