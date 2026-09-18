import {
  DEFAULT_FOOD_MERCHANT_AUTHORIZATION_SCOPE,
  buildFoodMerchantOutreachCandidate,
  buildSpanishFoodMerchantPermissionMessage,
  merchantAuthorizationMayPromoteOutlet,
} from '../src/foodCatalog/foodMerchantOutreach.js';
import type { FoodOutletIdentity } from '../src/foodCatalog/foodCatalogModel.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const outlet: FoodOutletIdentity = {
  outletKey: 'cl-rm-test-outlet',
  brandName: 'Restaurante Prueba',
  outletName: 'Providencia',
  address: 'Av. Prueba 123',
  comuna: 'Providencia',
  publicContact: {
    whatsapp: '+56912345678',
    phone: '+56223456789',
  },
  identityStatus: 'platform_only',
  evidence: [
    {
      kind: 'uber_eats',
      url: 'https://www.ubereats.com/cl/store/example',
      observedAt: '2026-09-18',
    },
  ],
};

const candidate = buildFoodMerchantOutreachCandidate(outlet);
assert(candidate.status === 'ready_to_contact', 'Public WhatsApp should put outlet in outreach queue.');
assert(candidate.whatsapp === '+56912345678', 'Public WhatsApp must be preserved for outreach.');
assert(
  !DEFAULT_FOOD_MERCHANT_AUTHORIZATION_SCOPE.some((scope) => String(scope).includes('image')),
  'Default food outreach scope must not include images.',
);

const message = buildSpanishFoodMerchantPermissionMessage({
  brandName: outlet.brandName,
  outletName: 'Providencia',
});
assert(message.includes('No utilizaremos fotos de otras plataformas.'), 'Permission message must state the no-photo policy.');
assert(message.includes('Sí, autorizo'), 'Permission message should request an explicit affirmative response.');

assert(
  merchantAuthorizationMayPromoteOutlet(outlet, {
    outletKey: outlet.outletKey,
    status: 'authorized',
    channel: 'whatsapp',
    authorizedAt: '2026-09-18T10:30:00-03:00',
    scope: ['business_identity', 'outlet_address', 'public_contact', 'menu_item_names', 'menu_prices'],
    evidenceRef: 'whatsapp:conversation:test-1',
  }),
  'Explicit WhatsApp authorization covering identity and address should be usable as merchant authorization evidence.',
);

assert(
  !merchantAuthorizationMayPromoteOutlet(outlet, {
    outletKey: outlet.outletKey,
    status: 'authorized',
    channel: 'whatsapp',
    authorizedAt: '2026-09-18T10:30:00-03:00',
    scope: ['menu_item_names', 'menu_prices'],
    evidenceRef: 'whatsapp:conversation:test-2',
  }),
  'Menu-only authorization must not silently authorize the outlet identity/address.',
);

console.log('PASS: food merchant outreach stays factual-only and records explicit authorization scope');
