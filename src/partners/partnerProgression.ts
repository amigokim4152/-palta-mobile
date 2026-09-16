import type {
  PartnerCapability,
  PartnerIntegrationLevel,
} from './partnerCapability.js';

const levelRank: Record<PartnerIntegrationLevel, number> = {
  information_only: 0,
  deep_link: 1,
  structured_exchange: 2,
  transactional_api: 3,
};

export function mayUpgradePartnerConnection(input: {
  current: PartnerIntegrationLevel;
  target: PartnerIntegrationLevel;
  requestedCapabilities: readonly PartnerCapability[];
}): boolean {
  if (levelRank[input.target] < levelRank[input.current]) return false;

  if (
    input.target === 'information_only' &&
    input.requestedCapabilities.some((capability) =>
      ['quote', 'booking', 'claim', 'payment', 'status'].includes(capability),
    )
  ) {
    return false;
  }

  return true;
}
