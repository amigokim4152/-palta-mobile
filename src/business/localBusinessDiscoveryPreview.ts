export type LocalBusinessDiscoveryHighlight = Readonly<{
  kind: 'coupon' | 'post' | 'unknown';
  label: string;
}>;

export type LocalBusinessDiscoveryPreview = Readonly<{
  photoUrl?: string;
  serviceLabels: readonly string[];
  highlight?: LocalBusinessDiscoveryHighlight;
}>;

export type LocalBusinessDiscoveryPreviewInput = Readonly<{
  photoUrls?: readonly string[];
  serviceLabels?: readonly string[];
  activeCouponTitle?: string;
  recentPostTitle?: string;
}>;

const MAX_SERVICE_LABELS = 2;
const MAX_LABEL_LENGTH = 80;
const MAX_HIGHLIGHT_LENGTH = 90;

const CONSUMER_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  auto_repair: 'Taller mecánico',
  pharmacy: 'Farmacia',
  restaurant: 'Restaurante',
  cafe: 'Café',
  bakery: 'Panadería',
  beauty: 'Belleza',
  home_repair: 'Hogar y reparación',
  pet: 'Mascotas',
  education: 'Clases y educación',
  professional_service: 'Servicios profesionales',
};

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return undefined;
  return clean.slice(0, maxLength);
}

function safePublicPhoto(value: string | undefined): string | undefined {
  const clean = value?.trim();
  if (!clean) return undefined;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    if (!parsed.hostname || parsed.username || parsed.password) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function firstPublicPhoto(values: readonly string[] | undefined): string | undefined {
  if (!values) return undefined;
  for (const value of values) {
    const safe = safePublicPhoto(value);
    if (safe) return safe;
  }
  return undefined;
}

function normalizedServiceLabels(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .filter((value): value is string => typeof value === 'string')
      .map((label) => cleanText(label, MAX_LABEL_LENGTH))
      .filter((label): label is string => Boolean(label)),
  )].slice(0, MAX_SERVICE_LABELS);
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function highlightKind(value: unknown): LocalBusinessDiscoveryHighlight['kind'] {
  return value === 'coupon' || value === 'post' ? value : 'unknown';
}

function normalizedHighlight(
  value: unknown,
  kindHint?: unknown,
): LocalBusinessDiscoveryHighlight | undefined {
  if (typeof value === 'string') {
    const label = cleanText(value, MAX_HIGHLIGHT_LENGTH);
    return label ? { kind: highlightKind(kindHint), label } : undefined;
  }

  const row = record(value);
  if (!row) return undefined;
  const label = cleanText(
    typeof row.label === 'string' ? row.label : undefined,
    MAX_HIGHLIGHT_LENGTH,
  );
  if (!label) return undefined;
  return { kind: highlightKind(row.kind ?? kindHint), label };
}

/**
 * Normalizes both the canonical nested preview and the temporary flat search
 * payload into one bounded presentation object. Consumers must use this
 * function instead of reading image_url/service_labels/highlight directly.
 */
export function readLocalBusinessDiscoveryPreview(
  value: unknown,
): LocalBusinessDiscoveryPreview {
  const source = record(value);
  if (!source) return { serviceLabels: [] };
  const nested = record(source.preview);
  const preview = nested ?? source;

  const rawPhoto =
    typeof preview.photoUrl === 'string'
      ? preview.photoUrl
      : typeof preview.photo_url === 'string'
        ? preview.photo_url
        : typeof preview.image_url === 'string'
          ? preview.image_url
          : nested && typeof source.image_url === 'string'
            ? source.image_url
            : undefined;
  const photoUrl = safePublicPhoto(rawPhoto);

  const serviceValues =
    preview.serviceLabels ??
    preview.service_labels ??
    (nested ? source.service_labels : undefined);
  const serviceLabels = normalizedServiceLabels(serviceValues);

  const rawHighlight = preview.highlight ?? (nested ? source.highlight : undefined);
  const kindHint =
    preview.highlight_kind ??
    preview.highlightKind ??
    (nested ? source.highlight_kind ?? source.highlightKind : undefined);
  const highlight = normalizedHighlight(rawHighlight, kindHint);

  return {
    ...(photoUrl ? { photoUrl } : {}),
    serviceLabels,
    ...(highlight ? { highlight } : {}),
  };
}

/** Internal taxonomy keys never become consumer copy unless explicitly mapped. */
export function localBusinessConsumerCategoryLabel(
  categoryKey: string | undefined,
): string | undefined {
  if (!categoryKey) return undefined;
  return CONSUMER_CATEGORY_LABELS[categoryKey];
}

export function buildLocalBusinessDiscoveryPreview(
  input: LocalBusinessDiscoveryPreviewInput,
): LocalBusinessDiscoveryPreview {
  const serviceLabels = normalizedServiceLabels(input.serviceLabels);

  const coupon = cleanText(input.activeCouponTitle, MAX_HIGHLIGHT_LENGTH);
  const post = cleanText(input.recentPostTitle, MAX_HIGHLIGHT_LENGTH);
  const highlight = coupon
    ? { kind: 'coupon' as const, label: coupon }
    : post
      ? { kind: 'post' as const, label: post }
      : undefined;
  const photoUrl = firstPublicPhoto(input.photoUrls);

  return {
    ...(photoUrl ? { photoUrl } : {}),
    serviceLabels,
    ...(highlight ? { highlight } : {}),
  };
}
