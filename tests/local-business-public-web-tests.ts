import { buildPublicBusinessWebProjection } from '../src/business/publicBusinessWebProjection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const projection = buildPublicBusinessWebProjection({
  businessId: 'biz-001',
  publicSlug: 'panaderia-los-alerces',
  origin: 'https://somospalta.cl/',
  name: 'Panadería Los Alerces',
  categoryLabel: 'Panadería',
  schemaTypes: ['Bakery'],
  description: 'Panadería de barrio con pan fresco, pastelería y retiro en local.',
  phone: '+56912345678',
  instagramUrl: 'https://www.instagram.com/panaderialosalerces/',
  sameAsUrls: [
    'https://www.tiktok.com/@panaderialosalerces',
    'https://www.google.com/maps?cid=123',
    'https://www.instagram.com/panaderialosalerces/',
  ],
  imageUrls: ['https://media.somospalta.cl/biz-001/cover.jpg'],
  address: {
    streetAddress: 'Av. Ejemplo 123',
    addressLocality: 'Vitacura',
    addressRegion: 'Región Metropolitana',
    addressCountry: 'CL',
  },
  location: { lat: -33.38, lng: -70.57 },
  openingHours: [
    { dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '19:00' },
  ],
  operationalState: 'open_now',
  operationalConfirmedAt: '2026-09-17T08:00:00-03:00',
  publicationState: 'public',
});

assert(
  projection.canonicalUrl === 'https://somospalta.cl/negocios/panaderia-los-alerces',
  'A Business must project to one stable canonical public URL.',
);
assert(projection.robots === 'index,follow', 'A valid explicitly public Business should be indexable.');
assert(projection.sitemapEligible, 'A valid explicitly public Business should be eligible for the sitemap.');
assert(
  projection.title.includes('Panadería Los Alerces') && projection.title.includes('Vitacura'),
  'Search title should explain the real business and locality.',
);

const jsonLd = projection.jsonLd;
const types = jsonLd['@type'];
assert(
  Array.isArray(types) && types.includes('LocalBusiness') && types.includes('Bakery'),
  'JSON-LD should include LocalBusiness plus a more specific applicable subtype.',
);
assert(jsonLd.url === projection.canonicalUrl, 'JSON-LD URL must match canonical URL.');
assert(
  Array.isArray(jsonLd.sameAs) && jsonLd.sameAs.includes('https://www.instagram.com/panaderialosalerces/'),
  'Existing social channels should be linked from the same canonical Business projection.',
);
assert(
  Array.isArray(jsonLd.sameAs) && jsonLd.sameAs.includes('https://www.tiktok.com/@panaderialosalerces'),
  'Generic public channel URLs should flow into LocalBusiness sameAs metadata.',
);
assert(
  Array.isArray(jsonLd.sameAs) && jsonLd.sameAs.filter((value) => value === 'https://www.instagram.com/panaderialosalerces/').length === 1,
  'Duplicate social URLs should be de-duplicated before structured-data publication.',
);

const duplicate = buildPublicBusinessWebProjection({
  businessId: 'biz-001-duplicate',
  publicSlug: 'panaderia-los-alerces-duplicado',
  origin: 'https://somospalta.cl',
  name: 'Panadería Los Alerces',
  publicationState: 'duplicate',
});
assert(duplicate.robots === 'noindex,follow', 'Duplicate records must not become SEO landing pages.');
assert(!duplicate.sitemapEligible, 'Duplicate records must stay out of the sitemap.');

const unspecified = buildPublicBusinessWebProjection({
  businessId: 'biz-unspecified',
  publicSlug: 'negocio-sin-publicar',
  origin: 'https://somospalta.cl',
  name: 'Negocio sin publicar',
});
assert(
  unspecified.robots === 'noindex,follow' && !unspecified.sitemapEligible,
  'Missing publication state must fail closed; only explicit public status may enter search.',
);

const seasonal = buildPublicBusinessWebProjection({
  businessId: 'biz-algarrobo',
  publicSlug: 'cafe-playa-algarrobo',
  origin: 'https://somospalta.cl',
  name: 'Café Playa Algarrobo',
  categoryLabel: 'Café',
  address: { addressLocality: 'Algarrobo', addressRegion: 'Valparaíso', addressCountry: 'CL' },
  operationalState: 'seasonal_closed',
  operationalConfirmedAt: '2026-09-10T12:00:00-03:00',
  publicationState: 'public',
});
assert(
  seasonal.description.includes('Cerrado por temporada'),
  'Public projection should communicate seasonal reality instead of pretending the business is open.',
);
assert(seasonal.sitemapEligible, 'A real seasonal business page remains useful public information.');

console.log('PASS: Local Business canonical public web + SEO projection');
