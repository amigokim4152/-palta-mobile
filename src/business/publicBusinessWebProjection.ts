import type { BusinessOperationalState } from './businessOperationalState.js';

export type PublicBusinessAddress = {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
};

export type PublicBusinessOpeningHours = {
  dayOfWeek: string | readonly string[];
  opens: string;
  closes: string;
  validFrom?: string;
  validThrough?: string;
};

export type PublicBusinessWebInput = {
  businessId: string;
  publicSlug: string;
  origin: string;
  name: string;
  description?: string;
  categoryLabel?: string;
  schemaTypes?: readonly string[];
  phone?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  sameAsUrls?: readonly string[];
  imageUrls?: readonly string[];
  address?: PublicBusinessAddress;
  location?: { lat: number; lng: number };
  serviceAreaLabels?: readonly string[];
  openingHours?: readonly PublicBusinessOpeningHours[];
  operationalState?: BusinessOperationalState;
  operationalConfirmedAt?: string;
  updatedAt?: string;
  publicationState?: 'public' | 'draft' | 'duplicate' | 'invalid';
};

export type PublicBusinessWebProjection = {
  canonicalPath: string;
  canonicalUrl: string;
  title: string;
  description: string;
  robots: 'index,follow' | 'noindex,follow';
  sitemapEligible: boolean;
  lastModified?: string;
  jsonLd: Record<string, unknown>;
};

function cleanOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

function cleanSlug(slug: string): string {
  return slug.trim().replace(/^\/+|\/+$/g, '');
}

function compact<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (
      item === undefined ||
      item === null ||
      item === '' ||
      (Array.isArray(item) && item.length === 0)
    ) {
      delete value[key];
    }
  }
  return value;
}

function normalizeSchemaTypes(types?: readonly string[]): string | string[] {
  const normalized = [...new Set((types ?? []).map((item) => item.trim()).filter(Boolean))];
  if (!normalized.includes('LocalBusiness')) normalized.unshift('LocalBusiness');
  return normalized.length === 1 ? normalized[0]! : normalized;
}

function operationalLabel(state?: BusinessOperationalState): string | undefined {
  switch (state) {
    case 'open_now':
      return 'Abierto ahora';
    case 'closed_now':
      return 'Cerrado ahora';
    case 'closed_today':
      return 'Cerrado hoy';
    case 'temporarily_closed':
      return 'Cerrado temporalmente';
    case 'seasonal_closed':
      return 'Cerrado por temporada';
    case 'paused':
      return 'Atención pausada';
    case 'permanently_closed':
      return 'Cerrado permanentemente';
    case 'unknown_or_stale':
      return 'Horario por confirmar';
    default:
      return undefined;
  }
}

/**
 * Provider-neutral projection for the future public Palta Business renderer.
 *
 * One canonical Business produces one canonical public URL. Category/comuna
 * discovery pages may link here, but they must not clone the same Business page
 * under multiple SEO URLs. Publication is fail-closed: only an explicitly
 * `public` Business may be indexed or enter a sitemap.
 */
export function buildPublicBusinessWebProjection(
  input: PublicBusinessWebInput,
): PublicBusinessWebProjection {
  const slug = cleanSlug(input.publicSlug);
  if (!slug) throw new Error('publicSlug is required');
  if (!input.businessId.trim()) throw new Error('businessId is required');
  if (!input.name.trim()) throw new Error('name is required');

  const canonicalPath = `/negocios/${encodeURIComponent(slug)}`;
  const canonicalUrl = `${cleanOrigin(input.origin)}${canonicalPath}`;
  const locality = input.address?.addressLocality;
  const category = input.categoryLabel?.trim();
  const titleParts = [input.name.trim(), category, locality].filter(Boolean);
  const title = `${titleParts.join(' · ')} | Palta`;
  const stateLabel = operationalLabel(input.operationalState);
  const fallbackDescription = [
    category ? `${category} en ${locality ?? 'Chile'}` : undefined,
    stateLabel,
    'Información, contacto y novedades del negocio en Palta.',
  ]
    .filter(Boolean)
    .join(' · ');
  const description = (input.description?.trim() || fallbackDescription).slice(0, 320);

  const indexable = input.publicationState === 'public';
  const sameAs = [
    input.websiteUrl,
    input.instagramUrl,
    input.facebookUrl,
    ...(input.sameAsUrls ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());
  const uniqueSameAs = [...new Set(sameAs)];

  const address = input.address
    ? compact<Record<string, unknown>>({
        '@type': 'PostalAddress',
        streetAddress: input.address.streetAddress,
        addressLocality: input.address.addressLocality,
        addressRegion: input.address.addressRegion,
        postalCode: input.address.postalCode,
        addressCountry: input.address.addressCountry ?? 'CL',
      })
    : undefined;

  const geo = input.location
    ? {
        '@type': 'GeoCoordinates',
        latitude: input.location.lat,
        longitude: input.location.lng,
      }
    : undefined;

  const openingHoursSpecification = input.openingHours?.map((hours) =>
    compact<Record<string, unknown>>({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.dayOfWeek,
      opens: hours.opens,
      closes: hours.closes,
      validFrom: hours.validFrom,
      validThrough: hours.validThrough,
    }),
  );

  const areaServed = input.serviceAreaLabels?.map((name) => ({
    '@type': 'AdministrativeArea',
    name,
  }));

  const jsonLd = compact<Record<string, unknown>>({
    '@context': 'https://schema.org',
    '@type': normalizeSchemaTypes(input.schemaTypes),
    '@id': `${canonicalUrl}#business`,
    url: canonicalUrl,
    name: input.name.trim(),
    description,
    telephone: input.phone,
    image: input.imageUrls ? [...input.imageUrls] : undefined,
    address,
    geo,
    areaServed,
    openingHoursSpecification,
    sameAs: uniqueSameAs,
  });

  return {
    canonicalPath,
    canonicalUrl,
    title,
    description,
    robots: indexable ? 'index,follow' : 'noindex,follow',
    sitemapEligible: indexable,
    ...(input.updatedAt || input.operationalConfirmedAt
      ? { lastModified: input.updatedAt ?? input.operationalConfirmedAt }
      : {}),
    jsonLd,
  };
}
