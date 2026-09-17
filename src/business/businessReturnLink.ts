export type BusinessReturnLinkSource =
  | 'counter'
  | 'packaging'
  | 'receipt'
  | 'social'
  | 'external_delivery'
  | 'owner_share'
  | 'other';

export type BusinessReturnLink = Readonly<{
  canonicalBusinessUrl: string;
  destinationUrl: string;
  qrPayload: string;
  source: BusinessReturnLinkSource;
  campaignId?: string;
}>;

function safeHttpUrl(value: string): URL {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Business return link requires an http(s) canonical URL');
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Business return link canonical URL is invalid');
  }
  return parsed;
}

function safeToken(value: string): string {
  const clean = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(clean)) {
    throw new Error('Business return-link campaign id must be a short non-personal token');
  }
  return clean;
}

/**
 * Creates a return/share URL for a canonical Palta Business page.
 *
 * Attribution is deliberately aggregate-friendly and privacy-minimal: the URL
 * carries where the merchant placed the link, not a customer id, phone, email,
 * precise location or other personal identifier. The canonical Business URL
 * itself remains unchanged for SEO.
 */
export function buildBusinessReturnLink(input: {
  canonicalBusinessUrl: string;
  source: BusinessReturnLinkSource;
  campaignId?: string;
}): BusinessReturnLink {
  const canonical = safeHttpUrl(input.canonicalBusinessUrl);
  canonical.search = '';
  canonical.hash = '';

  const destination = new URL(canonical.toString());
  destination.searchParams.set('sp_source', input.source);
  destination.searchParams.set('sp_medium', 'business_return');
  if (input.campaignId) destination.searchParams.set('sp_campaign', safeToken(input.campaignId));

  const destinationUrl = destination.toString();
  return {
    canonicalBusinessUrl: canonical.toString(),
    destinationUrl,
    qrPayload: destinationUrl,
    source: input.source,
    ...(input.campaignId ? { campaignId: safeToken(input.campaignId) } : {}),
  };
}

export type BusinessReturnAttribution = Readonly<{
  source: BusinessReturnLinkSource;
  campaignId?: string;
}>;

const RETURN_SOURCES = new Set<BusinessReturnLinkSource>([
  'counter',
  'packaging',
  'receipt',
  'social',
  'external_delivery',
  'owner_share',
  'other',
]);

/**
 * Parses only Palta's small allow-listed aggregate attribution fields. Unknown
 * query parameters are ignored and must never be promoted into a customer CRM
 * record by this helper.
 */
export function parseBusinessReturnAttribution(url: string): BusinessReturnAttribution | null {
  const parsed = safeHttpUrl(url);
  const source = parsed.searchParams.get('sp_source');
  const medium = parsed.searchParams.get('sp_medium');
  if (medium !== 'business_return' || !source || !RETURN_SOURCES.has(source as BusinessReturnLinkSource)) {
    return null;
  }

  const rawCampaign = parsed.searchParams.get('sp_campaign');
  let campaignId: string | undefined;
  if (rawCampaign) {
    try {
      campaignId = safeToken(rawCampaign);
    } catch {
      return null;
    }
  }

  return {
    source: source as BusinessReturnLinkSource,
    ...(campaignId ? { campaignId } : {}),
  };
}

export function businessReturnLinkLabel(source: BusinessReturnLinkSource): string {
  switch (source) {
    case 'packaging':
      return 'Vuelve a encontrarnos en Palta';
    case 'receipt':
      return 'Guarda este negocio en Palta';
    case 'counter':
      return 'Síguenos en Palta';
    case 'external_delivery':
      return 'La próxima vez, encuéntranos directo en Palta';
    case 'social':
      return 'Ver perfil y beneficios en Palta';
    case 'owner_share':
      return 'Ver este negocio en Palta';
    default:
      return 'Encuéntranos en Palta';
  }
}
