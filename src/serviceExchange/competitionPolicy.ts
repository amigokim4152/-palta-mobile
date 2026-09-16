export type PromotionLabel =
  | 'organic'
  | 'sponsored'
  | 'preferred_partner';

export type ListingPresentation = {
  providerId: string;
  promotionLabel: PromotionLabel;
  canEnterOrganicQuotePool: boolean;
};

export function validateListingPresentation(
  input: ListingPresentation,
): { valid: boolean; reason?: string } {
  if (
    input.promotionLabel === 'sponsored' &&
    input.canEnterOrganicQuotePool === false
  ) {
    return { valid: true };
  }

  if (
    input.promotionLabel === 'organic' &&
    input.canEnterOrganicQuotePool === true
  ) {
    return { valid: true };
  }

  if (
    input.promotionLabel === 'preferred_partner' &&
    input.canEnterOrganicQuotePool === false
  ) {
    return { valid: true };
  }

  return {
    valid: false,
    reason:
      'Paid/preferred placement must not be silently mixed into the organic quote pool.',
  };
}
