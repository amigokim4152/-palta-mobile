import {
  buildPublicBusinessDiscoveryWebProjection,
  describeDiscoveryItemState,
} from '../src/business/publicBusinessDiscoveryWebProjection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const projection = buildPublicBusinessDiscoveryWebProjection({
  origin: 'https://somospalta.cl/',
  areaSlug: 'algarrobo',
  areaLabel: 'Algarrobo',
  categorySlug: 'cafes',
  categoryLabel: 'Cafés',
  hasUsefulLocalContext: true,
  localContext: 'Opciones para tomar café cerca de la costa y el centro de Algarrobo.',
  businesses: [
    {
      businessId: 'biz-cafe-open',
      name: 'Café Costa',
      canonicalUrl: 'https://somospalta.cl/negocios/cafe-costa-algarrobo',
      operationalState: 'open_now',
    },
    {
      businessId: 'biz-cafe-seasonal',
      name: 'Café de Verano',
      canonicalUrl: 'https://somospalta.cl/negocios/cafe-de-verano',
      operationalState: 'seasonal_closed',
    },
    {
      businessId: 'biz-cafe-dead',
      name: 'Café Cerrado',
      canonicalUrl: 'https://somospalta.cl/negocios/cafe-cerrado',
      operationalState: 'permanently_closed',
    },
    {
      businessId: 'biz-cafe-open',
      name: 'Café Costa duplicado',
      canonicalUrl: 'https://somospalta.cl/negocios/cafe-costa-duplicado',
      operationalState: 'open_now',
    },
  ],
});

assert(
  projection.canonicalUrl === 'https://somospalta.cl/lugares/algarrobo/cafes',
  'A real locality/category discovery surface should have one stable canonical URL.',
);
assert(projection.robots === 'index,follow', 'Useful real local discovery may be indexable.');
assert(projection.sitemapEligible, 'Useful local discovery may enter the sitemap.');
assert(projection.items.length === 2, 'Permanent closures and duplicate Business identities must be removed.');
assert(
  projection.items.every((item) => item.canonicalUrl.includes('/negocios/')),
  'Aggregate pages must link to canonical Business pages rather than clone them.',
);
assert(
  projection.description.includes('1 lugar abierto ahora'),
  'Discovery metadata should use current availability when it is known.',
);
assert(
  (projection.jsonLd.numberOfItems as number) === 2,
  'ItemList structured data should match the distinct discoverable businesses.',
);
assert(
  describeDiscoveryItemState('seasonal_closed') === 'cerrados por temporada',
  'Seasonal closure must remain visible context instead of pretending the place is currently usable.',
);

const doorwayLike = buildPublicBusinessDiscoveryWebProjection({
  origin: 'https://somospalta.cl',
  areaSlug: 'comuna-x',
  areaLabel: 'Comuna X',
  categorySlug: 'gasfiter',
  categoryLabel: 'Gasfíter',
  hasUsefulLocalContext: false,
  businesses: [
    {
      businessId: 'biz-one',
      name: 'Servicio Uno',
      canonicalUrl: 'https://somospalta.cl/negocios/servicio-uno',
      operationalState: 'open_now',
    },
  ],
});
assert(
  doorwayLike.robots === 'noindex,follow' && !doorwayLike.sitemapEligible,
  'A thin generated locality page without useful local context must not become an SEO doorway page.',
);

const empty = buildPublicBusinessDiscoveryWebProjection({
  origin: 'https://somospalta.cl',
  areaSlug: 'algarrobo',
  areaLabel: 'Algarrobo',
  categorySlug: 'servicio-inexistente',
  categoryLabel: 'Servicio inexistente',
  hasUsefulLocalContext: true,
  businesses: [],
});
assert(
  empty.robots === 'noindex,follow' && !empty.sitemapEligible,
  'A discovery page with no real businesses must not be indexed just to capture search traffic.',
);

console.log('PASS: Local Business useful local discovery web projection');
