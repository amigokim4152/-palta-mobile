import {
  buildBusinessReturnLink,
  businessReturnLinkLabel,
  parseBusinessReturnAttribution,
} from '../src/business/businessReturnLink.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const packaging = buildBusinessReturnLink({
  canonicalBusinessUrl: 'https://somospalta.cl/negocios/cafe-barrio?old=1#section',
  source: 'packaging',
  campaignId: 'bolsa-septiembre',
});

assert(
  packaging.canonicalBusinessUrl === 'https://somospalta.cl/negocios/cafe-barrio',
  'Return-link tracking must not mutate the canonical Business URL.',
);
assert(
  packaging.destinationUrl.includes('sp_source=packaging') &&
    packaging.destinationUrl.includes('sp_medium=business_return') &&
    packaging.destinationUrl.includes('sp_campaign=bolsa-septiembre'),
  'Return links should carry only small first-party source/campaign attribution.',
);
assert(packaging.qrPayload === packaging.destinationUrl, 'QR payload should be the same safe return URL, with no second tracking identity.');
assert(
  businessReturnLinkLabel('packaging') === 'Vuelve a encontrarnos en Palta',
  'Packaging should use a relationship-oriented label rather than a forced app-install message.',
);

const parsed = parseBusinessReturnAttribution(packaging.destinationUrl);
assert(parsed?.source === 'packaging', 'Palta should recover aggregate return-link source.');
assert(parsed?.campaignId === 'bolsa-septiembre', 'Allow-listed campaign token should round-trip.');

const externalDelivery = buildBusinessReturnLink({
  canonicalBusinessUrl: 'https://somospalta.cl/negocios/restaurante-demo',
  source: 'external_delivery',
});
assert(
  businessReturnLinkLabel(externalDelivery.source).includes('directo en Palta'),
  'External delivery acquisition can lead to a later direct Palta relationship without blocking the external platform.',
);

assert(
  parseBusinessReturnAttribution('https://somospalta.cl/negocios/cafe?sp_source=packaging&sp_medium=other') === null,
  'Unrelated query parameters must not be treated as Palta relationship attribution.',
);
assert(
  parseBusinessReturnAttribution('https://somospalta.cl/negocios/cafe?sp_source=user_123&sp_medium=business_return') === null,
  'Arbitrary identifiers must not be accepted as return-link source values.',
);

let personalTokenRejected = false;
try {
  buildBusinessReturnLink({
    canonicalBusinessUrl: 'https://somospalta.cl/negocios/cafe',
    source: 'packaging',
    campaignId: 'cliente@email.com',
  });
} catch {
  personalTokenRejected = true;
}
assert(personalTokenRejected, 'Campaign ids should reject free-form personal-looking values and remain short tokens.');

console.log('PASS: Local Business privacy-minimal merchant return links');
