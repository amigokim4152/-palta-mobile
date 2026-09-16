export type PartnerCapability =
  | 'information'
  | 'eligibility'
  | 'quote'
  | 'booking'
  | 'claim'
  | 'payment'
  | 'status'
  | 'document'
  | 'notification';

export type PartnerIntegrationLevel =
  | 'information_only'
  | 'deep_link'
  | 'structured_exchange'
  | 'transactional_api';

export type PartnerConnection = {
  id: string;
  partnerId: string;
  category: string;
  level: PartnerIntegrationLevel;
  capabilities: readonly PartnerCapability[];
  enabled: boolean;
};

export function supportsPartnerCapability(
  connection: PartnerConnection,
  capability: PartnerCapability,
): boolean {
  return connection.enabled && connection.capabilities.includes(capability);
}
