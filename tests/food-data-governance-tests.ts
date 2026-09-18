import {
  applyOutletCorroboration,
  type FoodOutletCorroboration,
  type FoodOutletIdentity,
} from '../src/foodCatalog/foodCatalogModel.js';
import {
  canPublishCurrentMenuPrice,
  decideFoodFactPromotion,
} from '../src/foodCatalog/foodDataGovernance.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const uberOnlyOutlet: FoodOutletIdentity = {
  outletKey: 'cl-rm-test-food-1',
  brandName: 'Test Food',
  address: 'Av. Test 123',
  comuna: 'Providencia',
  identityStatus: 'platform_only',
  evidence: [
    {
      kind: 'uber_eats',
      url: 'https://www.ubereats.com/cl/store/test/example',
      observedAt: '2026-09-18',
    },
  ],
};

const blockedUberPrice = decideFoodFactPromotion(uberOnlyOutlet, {
  fact: 'menu_item_price',
  evidence: uberOnlyOutlet.evidence,
});
assert(!blockedUberPrice.allowed, 'Uber-only evidence must not publish a canonical Palta price.');
assert(
  blockedUberPrice.reason === 'identity_not_ready',
  'Platform-only identity must stay outside canonical production.',
);

const corroboration: FoodOutletCorroboration = {
  outletKey: uberOnlyOutlet.outletKey,
  identityStatus: 'verified',
  address: 'Av. Test 123',
  publicContact: {
    phone: '+56223456789',
    website: 'https://testfood.cl/menu',
  },
  evidence: [
    {
      kind: 'official_website',
      url: 'https://testfood.cl/',
      observedAt: '2026-09-18',
    },
  ],
};

const effectiveOutlet = applyOutletCorroboration(uberOnlyOutlet, corroboration);
assert(effectiveOutlet.identityStatus === 'verified', 'Independent evidence should verify the outlet.');
assert(effectiveOutlet.publicContact?.phone === '+56223456789', 'Verified public phone should overlay research data.');
assert(effectiveOutlet.address === 'Av. Test 123', 'Verified address should remain available.');
assert(effectiveOutlet.evidence.length === 2, 'Research and independent provenance must both remain auditable.');

const stillBlockedUberOnlyMenu = decideFoodFactPromotion(effectiveOutlet, {
  fact: 'menu_item_name',
  evidence: [
    {
      kind: 'uber_eats',
      url: 'https://www.ubereats.com/cl/store/test/example',
      observedAt: '2026-09-18',
    },
  ],
});
assert(!stillBlockedUberOnlyMenu.allowed, 'Verified outlet identity must not make Uber-only menu facts canonical.');
assert(
  stillBlockedUberOnlyMenu.reason === 'research_only_source',
  'Uber-only menu facts must remain research observations.',
);

const officialMenuEvidence = [
  {
    kind: 'official_website' as const,
    url: 'https://testfood.cl/menu',
    observedAt: '2026-09-18',
  },
];
assert(
  canPublishCurrentMenuPrice(effectiveOutlet, officialMenuEvidence),
  'Official independent menu evidence should allow current price publication.',
);

const merchantEvidence = decideFoodFactPromotion(effectiveOutlet, {
  fact: 'menu_item_price',
  evidence: [
    {
      kind: 'merchant_registration',
      url: 'palta://merchant/test-food/menu',
      observedAt: '2026-09-18',
    },
  ],
});
assert(merchantEvidence.allowed, 'Merchant-confirmed data should be production eligible.');
assert(merchantEvidence.reason === 'merchant_confirmed', 'Merchant evidence should be explicitly identified.');

let mismatchBlocked = false;
try {
  applyOutletCorroboration(uberOnlyOutlet, {
    ...corroboration,
    outletKey: 'cl-rm-different-outlet',
  });
} catch (error) {
  mismatchBlocked = error instanceof Error && error.message === 'food_outlet_corroboration_key_mismatch';
}
assert(mismatchBlocked, 'Corroboration must never silently attach to a different outlet key.');

console.log('PASS: food data governance keeps research, independent corroboration and production canonical facts separate');
