import type { RevenueMechanism } from '../serviceExchange/revenueModel.js';

/**
 * Commercial metadata is deliberately stored outside PlayDiscoveryItem.
 * Organic discovery/ranking must never depend on compensation.
 */
export type PlayCompensationModel =
  | 'none'
  | 'affiliate_cpc'
  | 'affiliate_cpa'
  | 'affiliate_cps'
  | 'lead_fee'
  | 'booking_fee'
  | 'ticket_commission'
  | 'revenue_share'
  | 'sponsored';

export type PlayCommercialActionKind =
  | 'ticket'
  | 'booking'
  | 'reservation'
  | 'lead'
  | 'purchase';

export type PlayCommercialCapability = Readonly<{
  discoveryItemId: string;
  partnerConnectionId?: string;
  partnerId?: string;
  canonicalBusinessId?: string;
  offeringId?: string;
  compensationModel: PlayCompensationModel;
  actionKind: PlayCommercialActionKind;
  destinationUrl?: string;
  trackingCode?: string;
  campaignId?: string;
  currency?: string;
  commissionFixedMinor?: number;
  commissionBps?: number;
  disclosureRequired: boolean;
  enabled: boolean;
  validFrom?: string;
  validUntil?: string;
}>;

export type PlayCommercialAttributionEvent = Readonly<{
  discoveryItemId: string;
  capabilityId: string;
  event:
    | 'impression'
    | 'click'
    | 'lead'
    | 'booking'
    | 'purchase'
    | 'confirmed'
    | 'cancelled'
    | 'refunded';
  occurredAt: string;
  partnerReference?: string;
  amountMinor?: number;
  currency?: string;
}>;

export function playRevenueMechanism(
  model: PlayCompensationModel,
): RevenueMechanism | undefined {
  switch (model) {
    case 'lead_fee':
    case 'affiliate_cpa':
      return 'lead_fee';
    case 'booking_fee':
      return 'booking_fee';
    case 'ticket_commission':
    case 'affiliate_cps':
      return 'transaction_fee';
    case 'revenue_share':
    case 'affiliate_cpc':
      return 'partner_revenue_share';
    case 'sponsored':
      return 'sponsored_placement';
    case 'none':
      return undefined;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function validatePlayCommercialCapability(
  capability: PlayCommercialCapability,
): readonly string[] {
  const issues: string[] = [];
  if (!capability.discoveryItemId.trim()) issues.push('discovery_item_id_required');
  if (capability.destinationUrl && !isHttpUrl(capability.destinationUrl)) {
    issues.push('destination_url_invalid');
  }
  if (capability.commissionFixedMinor !== undefined && capability.commissionFixedMinor < 0) {
    issues.push('commission_fixed_minor_invalid');
  }
  if (
    capability.commissionBps !== undefined &&
    (!Number.isFinite(capability.commissionBps) || capability.commissionBps < 0 || capability.commissionBps > 10_000)
  ) {
    issues.push('commission_bps_invalid');
  }
  if (capability.compensationModel === 'sponsored' && !capability.disclosureRequired) {
    issues.push('sponsored_disclosure_required');
  }
  if (capability.compensationModel !== 'none' && !capability.partnerId && !capability.canonicalBusinessId) {
    issues.push('commercial_counterparty_required');
  }
  return [...new Set(issues)];
}

/**
 * Organic ranking never consumes this index. It is joined only after discovery
 * results are selected, when Palta decides which action/attribution path to use.
 */
export type PlayCommercialIndex = ReadonlyMap<string, readonly PlayCommercialCapability[]>;

export function indexPlayCommercialCapabilities(
  capabilities: readonly PlayCommercialCapability[],
): PlayCommercialIndex {
  const index = new Map<string, PlayCommercialCapability[]>();
  for (const capability of capabilities) {
    if (validatePlayCommercialCapability(capability).length || !capability.enabled) continue;
    const current = index.get(capability.discoveryItemId) ?? [];
    current.push(capability);
    index.set(capability.discoveryItemId, current);
  }
  return index;
}
