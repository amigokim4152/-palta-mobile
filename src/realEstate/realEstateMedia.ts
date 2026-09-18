export type RealEstateMediaKind = 'image' | 'floor_plan';
export type RealEstateMediaRole = 'cover' | 'gallery' | 'floor_plan';

/**
 * Real Estate owns the ordered relationship to a media asset. The binary,
 * transformations and storage provider remain owned by Media/Object Storage Core.
 */
export type RealEstateMediaRef = {
  mediaAssetId: string;
  kind: RealEstateMediaKind;
  role: RealEstateMediaRole;
  sortOrder: number;
  deliveryUrl?: string;
  width?: number;
  height?: number;
  altText?: string;
};

export type RealEstateListingMedia = {
  listingId: string;
  items: readonly RealEstateMediaRef[];
  generatedAt: string;
};

export interface RealEstateMediaRepository {
  getForListing(listingId: string): Promise<RealEstateListingMedia | null>;
}

export function sortRealEstateMedia(
  items: readonly RealEstateMediaRef[],
): readonly RealEstateMediaRef[] {
  return [...items].sort((left, right) => {
    if (left.role === 'cover' && right.role !== 'cover') return -1;
    if (right.role === 'cover' && left.role !== 'cover') return 1;
    if (left.role === 'floor_plan' && right.role === 'gallery') return 1;
    if (right.role === 'floor_plan' && left.role === 'gallery') return -1;
    return left.sortOrder - right.sortOrder;
  });
}

export function validateRealEstateMediaSet(
  media: RealEstateListingMedia,
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  let coverCount = 0;

  for (const item of media.items) {
    if (!item.mediaAssetId.trim()) errors.push('mediaAssetId is required.');
    if (ids.has(item.mediaAssetId)) errors.push(`Duplicate media asset: ${item.mediaAssetId}`);
    ids.add(item.mediaAssetId);
    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
      errors.push(`Invalid sort order: ${item.mediaAssetId}`);
    }
    if (item.role === 'cover') coverCount += 1;
    if (item.role === 'floor_plan' && item.kind !== 'floor_plan') {
      errors.push(`Floor-plan role requires floor_plan kind: ${item.mediaAssetId}`);
    }
  }

  if (coverCount > 1) errors.push('A listing may have at most one cover asset.');
  return errors;
}
