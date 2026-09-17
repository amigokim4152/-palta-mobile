import {
  renderBusinessSitemapXml,
  renderPublicBusinessHtml,
} from '../src/business/publicBusinessWebRenderer.js';
import { buildPublicBusinessWebProjection } from '../src/business/publicBusinessWebProjection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const projection = buildPublicBusinessWebProjection({
  businessId: 'biz-cafe-1',
  publicSlug: 'cafe-barrio-vitacura',
  origin: 'https://somospalta.cl',
  name: 'Café Barrio',
  categoryLabel: 'Café',
  description: 'Café de barrio con desayuno y pastelería.',
  operationalState: 'open_now',
  updatedAt: '2026-09-17T15:00:00Z',
  publicationState: 'public',
  sameAsUrls: ['https://www.instagram.com/cafebarrio/'],
});

const html = renderPublicBusinessHtml({
  projection,
  content: {
    name: 'Café Barrio',
    description: 'Café de barrio con desayuno y pastelería.',
    categoryLabel: 'Café',
    operationalLabel: 'Abierto ahora',
    hoursSummary: 'Lun–Vie 08:00–19:00',
    serviceLabels: ['Desayuno', 'Pastelería'],
    serviceAreaLabels: ['Vitacura'],
    whatsappUrl: 'https://wa.me/56912345678',
    externalLinks: [
      { label: 'Instagram', url: 'https://www.instagram.com/cafebarrio/' },
      { label: 'No seguro', url: 'javascript:alert(1)' },
    ],
    updates: [
      {
        title: 'Nuevo desayuno',
        body: 'Disponible desde hoy.',
        publishedAt: '2026-09-17T12:00:00-03:00',
      },
    ],
    coupon: {
      title: 'Café de regalo',
      description: 'Con tu desayuno.',
      redemptionInstruction: 'Muéstralo antes de pagar.',
      expiresAt: '2026-10-01T23:59:59-03:00',
    },
  },
});

assert(html.startsWith('<!doctype html>'), 'Public Business renderer should emit crawlable HTML, not a JS-only shell.');
assert(
  html.includes('<link rel="canonical" href="https://somospalta.cl/negocios/cafe-barrio-vitacura">'),
  'Rendered HTML must preserve the one canonical Business URL.',
);
assert(html.includes('application/ld+json'), 'Rendered HTML should embed LocalBusiness JSON-LD.');
assert(html.includes('Abierto ahora'), 'Readable body should expose current operating context to people too.');
assert(html.includes('Nuevo desayuno'), 'Useful owner-published updates should be readable in public HTML.');
assert(html.includes('Café de regalo'), 'A public eligible basic coupon may be useful page content.');
assert(!html.includes('javascript:alert(1)'), 'Unsafe external schemes must not render into the public page.');

const injectionProjection = buildPublicBusinessWebProjection({
  businessId: 'biz-injection',
  publicSlug: 'negocio-seguro',
  origin: 'https://somospalta.cl',
  name: '</script><script>alert(1)</script>',
  description: '<img src=x onerror=alert(2)>',
  publicationState: 'public',
});
const injectionHtml = renderPublicBusinessHtml({
  projection: injectionProjection,
  content: {
    name: '</script><script>alert(1)</script>',
    description: '<img src=x onerror=alert(2)>',
  },
});
assert(
  !injectionHtml.includes('</script><script>alert(1)</script>'),
  'Owner-entered text must not terminate the JSON-LD script or create executable HTML.',
);
assert(
  injectionHtml.includes('\\u003c/script\\u003e'),
  'JSON-LD should encode angle brackets rather than trusting owner-entered strings.',
);
assert(
  injectionHtml.includes('&lt;img src=x onerror=alert(2)&gt;'),
  'Visible owner-entered HTML must be escaped as text.',
);

const duplicate = buildPublicBusinessWebProjection({
  businessId: 'biz-duplicate',
  publicSlug: 'cafe-barrio-duplicate',
  origin: 'https://somospalta.cl',
  name: 'Café Barrio',
  publicationState: 'duplicate',
});
const sameCanonicalAgain = { ...projection };
const sitemap = renderBusinessSitemapXml([projection, duplicate, sameCanonicalAgain]);
assert(
  sitemap.includes('<loc>https://somospalta.cl/negocios/cafe-barrio-vitacura</loc>'),
  'Indexable canonical Business pages should enter the sitemap.',
);
assert(
  !sitemap.includes('cafe-barrio-duplicate'),
  'Duplicate/noindex Business records must not enter the sitemap.',
);
assert(
  sitemap.match(/<loc>/g)?.length === 1,
  'The sitemap must de-duplicate the same canonical Business URL.',
);
assert(
  sitemap.includes('<lastmod>2026-09-17T15:00:00.000Z</lastmod>'),
  'Valid last-modified evidence should flow into the sitemap.',
);

console.log('PASS: Local Business public HTML + sitemap renderer');
