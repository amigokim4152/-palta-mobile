import type { PlayDiscoveryItem, PlayThemeKey } from './playDiscovery.js';

export type ResolvedBusinessPlayExposure = Readonly<{
  businessId: string;
  title: string;
  comuna: string;
  venue?: string;
  imageUrl?: string;
  distanceLabel?: string;
  priceLabel?: string;
  audienceLabel?: string;
  scheduleLabel?: string;
  offeringId?: string;
  exposureReason: string;
  ownerManaged: boolean;
  playTags: readonly PlayThemeKey[];
  experienceTags?: readonly string[];
  sourceAuthority?: string;
}>;

/**
 * Consumes a Business-Core-approved exposure. Play does not classify ownership,
 * duplicate the business, or invent an offering. It renders the canonical id and
 * resolved Play tags supplied at the Business/Core boundary.
 */
export function projectBusinessExposureToPlay(
  exposure: ResolvedBusinessPlayExposure,
): PlayDiscoveryItem {
  if (!exposure.businessId.trim()) throw new Error('canonical_business_id_required');
  if (!exposure.title.trim()) throw new Error('business_title_required');
  if (!exposure.comuna.trim()) throw new Error('business_comuna_required');
  if (!exposure.exposureReason.trim()) throw new Error('exposure_reason_required');

  return {
    id: `business:${exposure.businessId}:${exposure.offeringId ?? exposure.exposureReason}`,
    sourceKind: 'business',
    title: exposure.title,
    comuna: exposure.comuna,
    ...(exposure.venue ? { venue: exposure.venue } : {}),
    scheduleLabel: exposure.scheduleLabel ?? 'Consulta disponibilidad',
    ...(exposure.imageUrl ? { imageUrl: exposure.imageUrl } : {}),
    ...(exposure.distanceLabel ? { distanceLabel: exposure.distanceLabel } : {}),
    ...(exposure.priceLabel ? { priceLabel: exposure.priceLabel } : {}),
    ...(exposure.audienceLabel ? { audienceLabel: exposure.audienceLabel } : {}),
    ...(exposure.experienceTags?.length ? { experienceTags: [...exposure.experienceTags] } : {}),
    themeTags: [...new Set(exposure.playTags)],
    businessId: exposure.businessId,
    businessProjection: {
      businessId: exposure.businessId,
      ...(exposure.offeringId ? { offeringId: exposure.offeringId } : {}),
      exposureReason: exposure.exposureReason,
      ownerManaged: exposure.ownerManaged,
    },
    source: {
      authority: exposure.sourceAuthority ?? (exposure.ownerManaged ? 'Negocio verificado' : 'Negocio'),
    },
  };
}

export function projectBusinessExposuresToPlay(
  exposures: readonly ResolvedBusinessPlayExposure[],
): PlayDiscoveryItem[] {
  return exposures.map(projectBusinessExposureToPlay);
}
