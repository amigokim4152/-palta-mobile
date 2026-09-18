import type { CommercialDeal } from '../partners/commercialDeal.js';
import { commercialDealIsActive } from '../partners/commercialDeal.js';

export type PlayCommercialActionKind =
  | 'ticket'
  | 'booking'
  | 'reservation'
  | 'lead'
  | 'purchase';

/**
 * Play owns only the action attachment. Economics and contract terms live in the
 * reusable Partner CommercialDeal core so restaurants, activities, tours and
 * accommodation can share the same deal model.
 */
export type PlayCommercialCapability = Readonly<{
  capabilityId: string;
  discoveryItemId: string;
  commercialDealId: string;
  partnerConnectionId?: string;
  actionKind: PlayCommercialActionKind;
  destinationUrl?: string;
  trackingCode?: string;
  campaignId?: string;
  enabled: boolean;
}>;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function validatePlayCommercialCapability(
  capability: PlayCommercialCapability,
): readonly string[] {
  const issues: string[] = [];
  if (!capability.capabilityId.trim()) issues.push('capability_id_required');
  if (!capability.discoveryItemId.trim()) issues.push('discovery_item_id_required');
  if (!capability.commercialDealId.trim()) issues.push('commercial_deal_id_required');
  if (capability.destinationUrl && !isHttpUrl(capability.destinationUrl)) issues.push('destination_url_invalid');
  return [...new Set(issues)];
}

export type PlayCommercialIndex = ReadonlyMap<string, readonly PlayCommercialCapability[]>;

/**
 * Organic ranking never consumes this index. Join it only after discovery items
 * have been selected and ordered.
 */
export function indexPlayCommercialCapabilities(
  capabilities: readonly PlayCommercialCapability[],
  deals: readonly CommercialDeal[],
  atIso: string,
): PlayCommercialIndex {
  const dealById = new Map(deals.map((deal) => [deal.dealId, deal]));
  const index = new Map<string, PlayCommercialCapability[]>();

  for (const capability of capabilities) {
    if (validatePlayCommercialCapability(capability).length || !capability.enabled) continue;
    const deal = dealById.get(capability.commercialDealId);
    if (!deal || !commercialDealIsActive(deal, atIso)) continue;
    const current = index.get(capability.discoveryItemId) ?? [];
    current.push(capability);
    index.set(capability.discoveryItemId, current);
  }
  return index;
}
