export type BusinessChannelProvider =
  | 'palta'
  | 'instagram'
  | 'facebook'
  | 'google_business'
  | 'whatsapp'
  | 'website'
  | 'delivery_marketplace'
  | 'marketplace'
  | 'pos'
  | 'other';

export type BusinessChannelConnectionLevel =
  | 'link_only'
  | 'assisted_share'
  | 'connected_read'
  | 'connected_publish'
  | 'connected_operate';

export type BusinessChannelConnectionStatus =
  | 'not_connected'
  | 'pending_authorization'
  | 'active'
  | 'restricted'
  | 'error';

export type BusinessChannelAccountKind =
  | 'personal'
  | 'creator'
  | 'professional'
  | 'business'
  | 'page'
  | 'unknown';

export type BusinessChannelCapability =
  | 'public_link'
  | 'assisted_share'
  | 'read_profile'
  | 'read_metrics'
  | 'publish_content'
  | 'sync_business_facts'
  | 'receive_messages'
  | 'send_messages'
  | 'receive_orders'
  | 'update_fulfillment'
  | 'sync_catalog'
  | 'sync_inventory';

export type BusinessChannelConnection = {
  businessId: string;
  provider: BusinessChannelProvider;
  level: BusinessChannelConnectionLevel;
  status: BusinessChannelConnectionStatus;
  accountKind?: BusinessChannelAccountKind;
  publicUrl?: string;
  externalAccountRef?: string;
  authorizedAt?: string;
  lastSuccessfulSyncAt?: string;
  capabilities: readonly BusinessChannelCapability[];
};

const levelRank: Record<BusinessChannelConnectionLevel, number> = {
  link_only: 0,
  assisted_share: 1,
  connected_read: 2,
  connected_publish: 3,
  connected_operate: 4,
};

/**
 * Connection capability is not commercial entitlement.
 * This only describes what the provider/account/authorization can technically do.
 */
export function supportsChannelLevel(
  connection: BusinessChannelConnection,
  required: BusinessChannelConnectionLevel,
): boolean {
  return (
    connection.status === 'active' &&
    levelRank[connection.level] >= levelRank[required]
  );
}

/**
 * A public link is first-class. Small merchants must not be forced to convert
 * a personal/social account merely to have it represented in Palta.
 */
export function canExposeChannelLink(
  connection: BusinessChannelConnection,
): boolean {
  return Boolean(
    connection.publicUrl &&
      connection.status !== 'restricted' &&
      connection.capabilities.includes('public_link'),
  );
}

/**
 * Provider API publishing must be explicitly available on the connection.
 * Never infer publish capability from the fact that a public social URL exists.
 */
export function canAutoPublishToChannel(
  connection: BusinessChannelConnection,
): boolean {
  return Boolean(
    supportsChannelLevel(connection, 'connected_publish') &&
      connection.authorizedAt &&
      connection.capabilities.includes('publish_content'),
  );
}

/**
 * Assisted share remains a valid fallback when automated API publishing is not
 * available or the external account type does not support it.
 */
export function resolveContentDistributionMode(
  connection: BusinessChannelConnection,
): 'automatic' | 'assisted' | 'link_only' | 'unavailable' {
  if (canAutoPublishToChannel(connection)) return 'automatic';

  if (
    connection.status === 'active' &&
    connection.capabilities.includes('assisted_share') &&
    levelRank[connection.level] >= levelRank.assisted_share
  ) {
    return 'assisted';
  }

  if (canExposeChannelLink(connection)) return 'link_only';
  return 'unavailable';
}

export function validateBusinessChannelConnection(
  connection: BusinessChannelConnection,
): readonly string[] {
  const issues: string[] = [];
  if (!connection.businessId.trim()) issues.push('business_id_required');

  if (
    levelRank[connection.level] >= levelRank.connected_read &&
    connection.status === 'active' &&
    !connection.authorizedAt
  ) {
    issues.push('authorization_required_for_connected_access');
  }

  if (
    connection.level === 'link_only' &&
    !connection.publicUrl &&
    connection.status === 'active'
  ) {
    issues.push('public_url_required_for_link_only');
  }

  if (
    connection.capabilities.includes('publish_content') &&
    levelRank[connection.level] < levelRank.connected_publish
  ) {
    issues.push('publish_capability_requires_connected_publish_level');
  }

  return issues;
}
