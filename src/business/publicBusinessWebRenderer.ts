import type { PublicBusinessWebProjection } from './publicBusinessWebProjection.js';

export type PublicBusinessPageLink = Readonly<{
  label: string;
  url: string;
}>;

export type PublicBusinessPageContent = Readonly<{
  name: string;
  description?: string;
  categoryLabel?: string;
  operationalLabel?: string;
  hoursSummary?: string;
  serviceLabels?: readonly string[];
  serviceAreaLabels?: readonly string[];
  phone?: string;
  whatsappUrl?: string;
  externalLinks?: readonly PublicBusinessPageLink[];
  imageUrls?: readonly string[];
  updates?: readonly Readonly<{
    title: string;
    body?: string;
    publishedAt?: string;
  }>[];
  coupon?: Readonly<{
    title: string;
    description?: string;
    redemptionInstruction?: string;
    expiresAt?: string;
  }>;
}>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function jsonLdForScript(value: Record<string, unknown>): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function renderLink(link: PublicBusinessPageLink): string {
  const safeUrl = safeHttpUrl(link.url);
  if (!safeUrl || !link.label.trim()) return '';
  return `<a href="${escapeHtml(safeUrl)}" rel="noopener noreferrer">${escapeHtml(link.label.trim())}</a>`;
}

function renderStringList(title: string, values: readonly string[] | undefined): string {
  const clean = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  if (!clean.length) return '';
  return `<section><h2>${escapeHtml(title)}</h2><p>${clean.map(escapeHtml).join(' · ')}</p></section>`;
}

/**
 * Provider-neutral HTML renderer for the public Business page.
 *
 * It deliberately emits useful readable HTML, not a JavaScript-only shell, so
 * people and crawlers can understand the same canonical Business facts. All
 * owner-entered text is escaped and only http(s) links are rendered.
 */
export function renderPublicBusinessHtml(input: {
  projection: PublicBusinessWebProjection;
  content: PublicBusinessPageContent;
  locale?: string;
}): string {
  const locale = input.locale?.trim() || 'es-CL';
  const projection = input.projection;
  const content = input.content;
  const canonical = safeHttpUrl(projection.canonicalUrl);
  if (!canonical) throw new Error('Public Business canonical URL must be http(s)');
  if (!content.name.trim()) throw new Error('Public Business page name is required');

  const images = (content.imageUrls ?? [])
    .map((url) => safeHttpUrl(url))
    .filter((url): url is string => Boolean(url))
    .slice(0, 6)
    .map((url, index) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(content.name.trim())}${index === 0 ? '' : ` ${index + 1}`}" loading="lazy">`)
    .join('');

  const contactLinks: PublicBusinessPageLink[] = [];
  if (content.whatsappUrl) contactLinks.push({ label: 'WhatsApp', url: content.whatsappUrl });
  contactLinks.push(...(content.externalLinks ?? []));
  const renderedLinks = contactLinks.map(renderLink).filter(Boolean).join(' · ');
  const phoneText = content.phone?.trim() ? `Teléfono: ${escapeHtml(content.phone.trim())}` : '';
  const contactParts = [phoneText, renderedLinks].filter(Boolean).join(' · ');

  const updates = (content.updates ?? [])
    .slice(0, 5)
    .filter((item) => item.title.trim())
    .map((item) => {
      const published = item.publishedAt?.trim()
        ? `<time datetime="${escapeHtml(item.publishedAt.trim())}">${escapeHtml(item.publishedAt.trim())}</time>`
        : '';
      return `<article><h3>${escapeHtml(item.title.trim())}</h3>${item.body?.trim() ? `<p>${escapeHtml(item.body.trim())}</p>` : ''}${published}</article>`;
    })
    .join('');

  const coupon = content.coupon?.title.trim()
    ? `<section><h2>Beneficio</h2><article><h3>${escapeHtml(content.coupon.title.trim())}</h3>${content.coupon.description?.trim() ? `<p>${escapeHtml(content.coupon.description.trim())}</p>` : ''}${content.coupon.redemptionInstruction?.trim() ? `<p>${escapeHtml(content.coupon.redemptionInstruction.trim())}</p>` : ''}${content.coupon.expiresAt?.trim() ? `<p>Válido hasta <time datetime="${escapeHtml(content.coupon.expiresAt.trim())}">${escapeHtml(content.coupon.expiresAt.trim())}</time></p>` : ''}</article></section>`
    : '';

  const bodyDescription = content.description?.trim() || projection.description;
  const status = [content.categoryLabel?.trim(), content.operationalLabel?.trim()]
    .filter((value): value is string => Boolean(value))
    .map(escapeHtml)
    .join(' · ');

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(projection.title)}</title>
<meta name="description" content="${escapeHtml(projection.description)}">
<meta name="robots" content="${escapeHtml(projection.robots)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<script type="application/ld+json">${jsonLdForScript(projection.jsonLd)}</script>
</head>
<body>
<main>
<header><h1>${escapeHtml(content.name.trim())}</h1>${status ? `<p>${status}</p>` : ''}<p>${escapeHtml(bodyDescription)}</p></header>
${images ? `<section aria-label="Fotos">${images}</section>` : ''}
${content.hoursSummary?.trim() ? `<section><h2>Horario</h2><p>${escapeHtml(content.hoursSummary.trim())}</p></section>` : ''}
${renderStringList('Servicios', content.serviceLabels)}
${renderStringList('Zona de atención', content.serviceAreaLabels)}
${contactParts ? `<section><h2>Contacto y enlaces</h2><p>${contactParts}</p></section>` : ''}
${coupon}
${updates ? `<section><h2>Novedades</h2>${updates}</section>` : ''}
</main>
</body>
</html>`;
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

/**
 * Sitemap is a projection of canonical pages, never a generator of duplicate
 * comuna/category doorway URLs. Non-indexable pages are excluded.
 */
export function renderBusinessSitemapXml(
  projections: readonly PublicBusinessWebProjection[],
): string {
  const seen = new Set<string>();
  const urls = projections
    .filter((projection) => projection.sitemapEligible && projection.robots === 'index,follow')
    .filter((projection) => {
      const safe = safeHttpUrl(projection.canonicalUrl);
      if (!safe || seen.has(safe)) return false;
      seen.add(safe);
      return true;
    })
    .map((projection) => {
      const canonical = safeHttpUrl(projection.canonicalUrl)!;
      const lastmod = projection.lastModified && Number.isFinite(Date.parse(projection.lastModified))
        ? `<lastmod>${escapeXml(new Date(projection.lastModified).toISOString())}</lastmod>`
        : '';
      return `<url><loc>${escapeXml(canonical)}</loc>${lastmod}</url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
