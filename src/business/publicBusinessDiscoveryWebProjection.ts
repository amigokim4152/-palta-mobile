import type { BusinessOperationalState } from './businessOperationalState.js';

export type PublicBusinessDiscoveryItem = Readonly<{
  businessId: string;
  name: string;
  canonicalUrl: string;
  categoryLabel?: string;
  localityLabel?: string;
  operationalState?: BusinessOperationalState;
  distanceMeters?: number;
  shortDescription?: string;
}>;

export type PublicBusinessDiscoveryWebProjection = Readonly<{
  canonicalPath: string;
  canonicalUrl: string;
  title: string;
  description: string;
  robots: 'index,follow' | 'noindex,follow';
  sitemapEligible: boolean;
  items: readonly PublicBusinessDiscoveryItem[];
  jsonLd: Record<string, unknown>;
}>;

function cleanOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

function cleanSlug(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function safeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function statusLabel(state?: BusinessOperationalState): string | undefined {
  switch (state) {
    case 'open_now': return 'abiertos ahora';
    case 'closed_now': return 'cerrados ahora';
    case 'closed_today': return 'cerrados hoy';
    case 'temporarily_closed': return 'cerrados temporalmente';
    case 'seasonal_closed': return 'cerrados por temporada';
    case 'unknown_or_stale': return 'con horario por confirmar';
    default: return undefined;
  }
}

/**
 * Canonical aggregate page for a real category + locality discovery surface.
 *
 * This is not a doorway-page factory. A page becomes indexable only when the
 * caller supplies real local context and at least one distinct discoverable
 * Business. The same Business stays canonical at its own /negocios/<slug> URL.
 */
export function buildPublicBusinessDiscoveryWebProjection(input: {
  origin: string;
  areaSlug: string;
  areaLabel: string;
  categorySlug: string;
  categoryLabel: string;
  localContext?: string;
  hasUsefulLocalContext: boolean;
  businesses: readonly PublicBusinessDiscoveryItem[];
}): PublicBusinessDiscoveryWebProjection {
  const areaSlug = cleanSlug(input.areaSlug);
  const categorySlug = cleanSlug(input.categorySlug);
  if (!areaSlug || !categorySlug) throw new Error('Discovery area/category slug is required');
  if (!input.areaLabel.trim() || !input.categoryLabel.trim()) {
    throw new Error('Discovery area/category label is required');
  }

  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const items = input.businesses.filter((item) => {
    if (!item.businessId.trim() || !item.name.trim()) return false;
    if (item.operationalState === 'permanently_closed') return false;
    const canonical = safeHttpUrl(item.canonicalUrl);
    if (!canonical || seenIds.has(item.businessId) || seenUrls.has(canonical)) return false;
    seenIds.add(item.businessId);
    seenUrls.add(canonical);
    return true;
  });

  const canonicalPath = `/lugares/${encodeURIComponent(areaSlug)}/${encodeURIComponent(categorySlug)}`;
  const canonicalUrl = `${cleanOrigin(input.origin)}${canonicalPath}`;
  const openCount = items.filter((item) => item.operationalState === 'open_now').length;
  const indexable = input.hasUsefulLocalContext && items.length > 0;
  const stateSummary = openCount > 0 ? `${openCount} ${openCount === 1 ? 'lugar abierto' : 'lugares abiertos'} ahora` : undefined;
  const description = [
    `${input.categoryLabel.trim()} en ${input.areaLabel.trim()}.`,
    stateSummary ? `${stateSummary}.` : undefined,
    input.localContext?.trim(),
    'Compara opciones reales y entra al perfil canónico de cada negocio en Palta.',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 320);

  const itemListElement = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: safeHttpUrl(item.canonicalUrl),
    name: item.name.trim(),
  }));

  return {
    canonicalPath,
    canonicalUrl,
    title: `${input.categoryLabel.trim()} en ${input.areaLabel.trim()} | Palta`,
    description,
    robots: indexable ? 'index,follow' : 'noindex,follow',
    sitemapEligible: indexable,
    items,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${input.categoryLabel.trim()} en ${input.areaLabel.trim()}`,
      url: canonicalUrl,
      numberOfItems: items.length,
      itemListElement,
    },
  };
}

export function describeDiscoveryItemState(state?: BusinessOperationalState): string | undefined {
  return statusLabel(state);
}
