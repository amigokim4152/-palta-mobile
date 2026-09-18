export type BusinessDiscoveryPreviewInput = {
  photoUrls?: readonly string[];
  serviceLabels?: readonly string[];
  activeBenefitTitle?: string;
  recentUsefulUpdateTitle?: string;
};

export type BusinessDiscoveryPreview = {
  imageUrl?: string;
  serviceLabels: string[];
  highlight?: string;
};

function cleanLabel(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

/**
 * Keep discovery cards intentionally small.
 *
 * The single highlight slot is reserved for a real current reason to look:
 * an active benefit first, then one useful recent update. Verification belongs
 * to trust metadata and must not consume this slot.
 */
export function projectBusinessDiscoveryPreview(
  input: BusinessDiscoveryPreviewInput,
): BusinessDiscoveryPreview {
  const imageUrl = input.photoUrls?.map(cleanLabel).find(Boolean);
  const serviceLabels = [...new Set(
    (input.serviceLabels ?? [])
      .map(cleanLabel)
      .filter((value): value is string => Boolean(value)),
  )].slice(0, 2);
  const activeBenefitTitle = cleanLabel(input.activeBenefitTitle);
  const recentUsefulUpdateTitle = cleanLabel(input.recentUsefulUpdateTitle);
  const highlight = activeBenefitTitle ?? recentUsefulUpdateTitle;

  return {
    ...(imageUrl ? { imageUrl } : {}),
    serviceLabels,
    ...(highlight ? { highlight } : {}),
  };
}
