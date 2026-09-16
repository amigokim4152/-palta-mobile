export type RevenueMechanism =
  | 'subscription'
  | 'transaction_fee'
  | 'booking_fee'
  | 'lead_fee'
  | 'sponsored_placement'
  | 'partner_revenue_share';

export type RevenueRule = {
  mechanism: RevenueMechanism;
  enabled: boolean;
  userVisibleDisclosureRequired: boolean;
  affectsOrganicRanking: boolean;
};

export function validateRevenueRule(
  rule: RevenueRule,
): { valid: boolean; reason?: string } {
  if (
    (rule.mechanism === 'sponsored_placement' ||
      rule.mechanism === 'lead_fee' ||
      rule.mechanism === 'partner_revenue_share') &&
    rule.affectsOrganicRanking
  ) {
    return {
      valid: false,
      reason:
        'Commercial compensation must not silently distort organic service routing.',
    };
  }

  return { valid: true };
}
