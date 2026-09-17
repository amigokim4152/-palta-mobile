import { buildBusinessShareAsset } from '../src/business/businessShareAsset.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const packaging = buildBusinessShareAsset({
  canonicalBusinessUrl: 'https://somospalta.cl/negocios/restaurante-demo',
  businessName: 'Restaurante Demo',
  variant: 'packaging_sticker',
  campaignId: 'bolsa-septiembre',
  supportingText: 'Horario, novedades y beneficios en un solo lugar.',
});
assert(packaging.source === 'packaging', 'Packaging asset should use packaging attribution.');
assert(packaging.qrPayload === packaging.destinationUrl, 'Printed asset QR should encode the same privacy-minimal return URL.');
assert(packaging.print?.widthMm === 60 && packaging.print.heightMm === 60, 'Packaging sticker should have a small default physical spec.');
assert(packaging.headline === 'Vuelve a encontrarnos en Palta', 'Packaging copy should invite a direct return relationship.');
assert(!packaging.destinationUrl.includes('user_id='), 'Free share assets must not hide a customer identifier in the QR URL.');

const counter = buildBusinessShareAsset({
  canonicalBusinessUrl: 'https://somospalta.cl/negocios/panaderia-demo',
  businessName: 'Panadería Demo',
  variant: 'counter_card',
});
assert(counter.source === 'counter', 'Counter card should use counter attribution.');
assert(counter.print?.widthMm === 100 && counter.print.heightMm === 150, 'Counter card should expose a renderer-neutral print size.');

const social = buildBusinessShareAsset({
  canonicalBusinessUrl: 'https://somospalta.cl/negocios/tienda-demo',
  businessName: 'Tienda Demo',
  variant: 'social_share',
});
assert(social.source === 'social', 'Social asset should use social attribution.');
assert(social.qrPayload === undefined, 'Social share should not require an unnecessary printed QR payload.');
assert(social.print === undefined, 'Social share should not invent a physical print size.');

console.log('PASS: Local Business free merchant share asset spec');
