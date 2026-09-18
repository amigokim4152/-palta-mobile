import type { RevenueMechanism } from '../serviceExchange/revenueModel.js';

export type CommercialDealStatus = 'free' | 'pilot' | 'active' | 'paused' | 'expired';

export type CommercialDealModel =
  | 'none'
  | 'cpa'
  | 'revenue_share'
  | 'reservation_fee'
  | 'promo_code'
  | 'sponsored'
  | 'featured'
  | 'hybrid';

export type CommercialPartnerType =
  | 'business'
  | 'venue'
  | 'organizer'
  | 'ticketing_partner'
  | 'activity_provider'
  | 'tour_operator'
  | 'accommodation'
  | 'other';

export type CommercialDeal = Readonly<{
  dealId: string;
  partnerType: CommercialPartnerType;
  partnerId: string;
  canonicalBusinessId?: string;
  venueId?: string;
  organizerId?: string;
  ticketingPartnerId?: string;
  status: CommercialDealStatus;
  model: CommercialDealModel;
  commissionRateBps?: number;
  fixedFeeMinor?: number;
  currency?: string;
  attributionMethod?: 'link' | 'promo_code' | 'webhook' | 'api' | 'manual_reconciliation';
  validFrom?: string;
  validTo?: string;
  settlementRule?: string;
  contractReference?: string;
  internalNotes?: string;
  userVisibleDisclosureRequired: boolean;
}>;

export function commercialDealRevenueMechanisms(deal: CommercialDeal): readonly RevenueMechanism[] {
  switch (deal.model) {
    case 'cpa': return ['lead_fee'];
    case 'revenue_share': return ['partner_revenue_share'];
    case 'reservation_fee': return ['booking_fee'];
    case 'sponsored':
    case 'featured': return ['sponsored_placement'];
    case 'hybrid': return ['booking_fee', 'partner_revenue_share'];
    case 'promo_code': return ['partner_revenue_share'];
    case 'none': return [];
  }
}

export function validateCommercialDeal(deal: CommercialDeal): readonly string[] {
  const issues: string[] = [];
  if (!deal.dealId.trim()) issues.push('deal_id_required');
  if (!deal.partnerId.trim()) issues.push('partner_id_required');
  if (deal.commissionRateBps !== undefined && (
    !Number.isFinite(deal.commissionRateBps) || deal.commissionRateBps < 0 || deal.commissionRateBps > 10_000
  )) issues.push('commission_rate_invalid');
  if (deal.fixedFeeMinor !== undefined && (!Number.isInteger(deal.fixedFeeMinor) || deal.fixedFeeMinor < 0)) {
    issues.push('fixed_fee_invalid');
  }
  if (deal.validFrom && deal.validTo && deal.validTo < deal.validFrom) issues.push('deal_period_invalid');
  if (deal.status === 'free' && deal.model !== 'none') issues.push('free_deal_must_use_none_model');
  if (deal.model === 'none' && (deal.commissionRateBps ?? 0) !== 0) issues.push('none_model_commission_must_be_zero');
  if ((deal.model === 'sponsored' || deal.model === 'featured') && !deal.userVisibleDisclosureRequired) {
    issues.push('commercial_disclosure_required');
  }
  return [...new Set(issues)];
}

export function commercialDealIsActive(deal: CommercialDeal, atIso: string): boolean {
  if (!['free', 'pilot', 'active'].includes(deal.status)) return false;
  if (deal.validFrom && atIso < deal.validFrom) return false;
  if (deal.validTo && atIso > deal.validTo) return false;
  return validateCommercialDeal(deal).length === 0;
}
