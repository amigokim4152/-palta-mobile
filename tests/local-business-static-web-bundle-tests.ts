import { buildPublicBusinessStaticBundle } from '../src/business/publicBusinessStaticBundle.js';
import { buildPublicBusinessWebProjection } from '../src/business/publicBusinessWebProjection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const publicProjection = buildPublicBusinessWebProjection({
  businessId: 'biz-1',
  publicSlug: 'cafe-barrio',
  origin: 'https://somospalta.cl',
  name: 'Café Barrio',
  categoryLabel: 'Café',
  publicationState: 'public',
  updatedAt: '2026-09-17T15:00:00Z',
});
const draftProjection = buildPublicBusinessWebProjection({
  businessId: 'biz-2',
  publicSlug: 'taller-en-preparacion',
  origin: 'https://somospalta.cl',
  name: 'Taller en preparación',
  publicationState: 'draft',
});

const bundle = buildPublicBusinessStaticBundle([
  {
    projection: publicProjection,
    content: {
      name: 'Café Barrio',
      description: 'Café de barrio.',
      operationalLabel: 'Abierto ahora',
    },
  },
  {
    projection: draftProjection,
    content: {
      name: 'Taller en preparación',
      description: 'Perfil todavía en preparación.',
    },
  },
]);

assert(bundle.pageCount === 1, 'Static publication should emit only truly public/indexable Business pages.');
assert(bundle.sitemapCount === 1, 'Only indexable canonical Business pages should enter the sitemap.');
assert(
  Boolean(bundle.files['negocios/cafe-barrio/index.html']),
  'Static bundle should map canonical public Business paths to crawlable index.html files.',
);
assert(
  bundle.files['negocios/taller-en-preparacion/index.html'] === undefined,
  'Draft/noindex Business profiles must not be emitted as publicly reachable static files.',
);
assert(
  bundle.files['sitemap-businesses.xml']?.includes('/negocios/cafe-barrio'),
  'Business sitemap should include the valid public page.',
);
assert(
  !bundle.files['sitemap-businesses.xml']?.includes('/negocios/taller-en-preparacion'),
  'Business sitemap should exclude draft/noindex pages.',
);

let duplicateRejected = false;
try {
  buildPublicBusinessStaticBundle([
    { projection: publicProjection, content: { name: 'Café Barrio' } },
    { projection: publicProjection, content: { name: 'Café Barrio duplicado' } },
  ]);
} catch {
  duplicateRejected = true;
}
assert(duplicateRejected, 'A static deployment must reject duplicate canonical Business pages instead of silently overwriting one.');

console.log('PASS: Local Business provider-neutral static public web bundle');
