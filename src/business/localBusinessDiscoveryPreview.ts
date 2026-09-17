export type LocalBusinessDiscoveryHighlight = Readonly<{
  kind: 'coupon' | 'post';
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

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return undefined;
  return clean.slice(0, maxLength);
}

function firstPublicPhoto(values: readonly string[] | undefined): string | undefined {
  if (!values) return undefined;
  for (const value of values) {
    const clean = value.trim();
    if (!/^https?:\/\//i.test(clean)) continue;
    return clean;
  }
  return undefined;
}

export function buildLocalBusinessDiscoveryPreview(
  input: LocalBusinessDiscoveryPreviewInput,
): LocalBusinessDiscoveryPreview {
  const serviceLabels = [...new Set(
    (input.serviceLabels ?? [])
      .map((label) => cleanText(label, MAX_LABEL_LENGTH))
      .filter((label): label is string => Boolean(label)),
  )].slice(0, MAX_SERVICE_LABELS);

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
