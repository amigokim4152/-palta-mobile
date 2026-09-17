export type BusinessChannelProvider =
  | 'palta'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
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

export type PublicBusinessChannelLink = {
  provider: Exclude<BusinessChannelProvider, 'palta' | 'pos'>;
  label: string;
  url: string;
};

export type PublicBusinessChannelProvider = PublicBusinessChannelLink['provider'];

/**
 * Local Business does not own plan/pricing logic. Shared Entitlement/Access will
 * eventually supply these grants. The free product boundary is explicit here:
 * link_only is free; any level that makes Palta do work across external channels
 * requires a positive entitlement grant.
 */
export type BusinessChannelEntitlementKey =
  | 'external_channel_assisted_share'
  | 'external_channel_connected_read'
  | 'external_channel_connected_publish'
  | 'external_channel_connected_operate';

export type BusinessChannelEntitlementSnapshot = Readonly<{
  grants: readonly BusinessChannelEntitlementKey[];
}>;

const levelRank: Record<BusinessChannelConnectionLevel, number> = {
  link_only: 0,
  assisted_share: 1,
  connected_read: 2,
  connected_publish: 3,
  connected_operate: 4,
};

const entitlementForLevel: Record<
  Exclude<BusinessChannelConnectionLevel, 'link_only'>,
  BusinessChannelEntitlementKey
> = {
  assisted_share: 'external_channel_assisted_share',
  connected_read: 'external_channel_connected_read',
  connected_publish: 'external_channel_connected_publish',
  connected_operate: 'external_channel_connected_operate',
};

const providerLabel: Partial<Record<BusinessChannelProvider, string>> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google_business: 'Google',
  whatsapp: 'WhatsApp',
  website: 'Sitio web',
  delivery_marketplace: 'Delivery',
  marketplace: 'Marketplace',
  other: 'Otro canal',
};

/** Technical/provider readiness only; this is not commercial entitlement. */
export function supportsChannelLevel(
  connection: BusinessChannelConnection,
  required: BusinessChannelConnectionLevel,
): boolean {
  return (
    connection.status === 'active' &&
    levelRank[connection.level] >= levelRank[required]
  );
}

export function entitlementRequiredForChannelLevel(
  level: BusinessChannelConnectionLevel,
): BusinessChannelEntitlementKey | null {
  if (level === 'link_only') return null;
  return entitlementForLevel[level];
}

export function hasChannelEntitlement(
  snapshot: BusinessChannelEntitlementSnapshot,
  required: BusinessChannelConnectionLevel,
): boolean {
  const key = entitlementRequiredForChannelLevel(required);
  return key === null || snapshot.grants.includes(key);
}

/** Commercial access and technical/provider readiness must both be true. */
export function canUseChannelLevel(
  connection: BusinessChannelConnection,
  entitlements: BusinessChannelEntitlementSnapshot,
  required: BusinessChannelConnectionLevel,
): boolean {
  return (
    supportsChannelLevel(connection, required) &&
    hasChannelEntitlement(entitlements, required)
  );
}

/**
 * Public external links are intentionally simple and cheap, but they are still
 * untrusted owner input. Only ordinary web URLs are exposed from the common
 * Business Profile. Custom/deep-link schemes belong behind explicit adapters.
 */
export function normalizeSafePublicChannelUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!parsed.hostname) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeBareWebAddress(value: string): string | null {
  if (/\s/.test(value) || !value.includes('.')) return null;
  return normalizeSafePublicChannelUrl(`https://${value}`);
}

/**
 * Owner-facing convenience normalization for Chilean microbusinesses. This is a
 * deterministic input helper, not an external API lookup. It lets an owner enter
 * the simple identifier they already know instead of forcing them to copy a full
 * URL from another app.
 */
export function normalizeOwnerPublicChannelInput(
  provider: PublicBusinessChannelProvider,
  value: string,
): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  const alreadyUrl = normalizeSafePublicChannelUrl(candidate);
  if (alreadyUrl) return alreadyUrl;

  if (provider === 'instagram') {
    const handle = candidate.replace(/^@/, '');
    if (/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
      return `https://www.instagram.com/${handle}/`;
    }
  }

  if (provider === 'tiktok') {
    const handle = candidate.replace(/^@/, '');
    if (/^[A-Za-z0-9._]{2,24}$/.test(handle)) {
      return `https://www.tiktok.com/@${handle}`;
    }
  }

  if (provider === 'facebook') {
    const slug = candidate.replace(/^@/, '');
    if (/^[A-Za-z0-9.]{3,80}$/.test(slug)) {
      return `https://www.facebook.com/${slug}`;
    }
  }

  if (provider === 'whatsapp') {
    let digits = candidate.replace(/\D/g, '');
    if (/^9\d{8}$/.test(digits)) digits = `56${digits}`;
    if (/^\d{8,15}$/.test(digits)) {
      return `https://wa.me/${digits}`;
    }
  }

  return normalizeBareWebAddress(candidate);
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
      normalizeSafePublicChannelUrl(connection.publicUrl) &&
      connection.status !== 'restricted' &&
      connection.capabilities.includes('public_link'),
  );
}

/**
 * Public Business pages expose only safe link projections, never provider tokens,
 * external account ids, authorization timestamps or operational capabilities.
 * Paid status must never remove a valid public link from the free profile.
 */
export function projectPublicBusinessChannelLinks(
  connections: readonly BusinessChannelConnection[],
): PublicBusinessChannelLink[] {
  const seen = new Set<string>();
  const links: PublicBusinessChannelLink[] = [];

  for (const connection of connections) {
    const safeUrl = connection.publicUrl
      ? normalizeSafePublicChannelUrl(connection.publicUrl)
      : null;
    if (
      connection.provider === 'palta' ||
      connection.provider === 'pos' ||
      !canExposeChannelLink(connection) ||
      !safeUrl
    ) {
      continue;
    }

    const key = `${connection.provider}:${safeUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);

    links.push({
      provider: connection.provider,
      label: providerLabel[connection.provider] ?? 'Canal externo',
      url: safeUrl,
    });
  }

  return links;
}

/**
 * Provider API publishing requires both provider authorization and commercial
 * entitlement. Never infer publish access from the fact that a public URL exists.
 */
export function canAutoPublishToChannel(
  connection: BusinessChannelConnection,
  entitlements: BusinessChannelEntitlementSnapshot,
): boolean {
  return Boolean(
    canUseChannelLevel(connection, entitlements, 'connected_publish') &&
      connection.authorizedAt &&
      connection.capabilities.includes('publish_content'),
  );
}

/**
 * Losing a paid entitlement stops automation but does not delete the owner's
 * public social/web link. This is a runtime/effective mode; stored OAuth state can
 * be retained or revoked by the integration/security policy separately.
 */
export function resolveContentDistributionMode(
  connection: BusinessChannelConnection,
  entitlements: BusinessChannelEntitlementSnapshot,
): 'automatic' | 'assisted' | 'link_only' | 'unavailable' {
  if (canAutoPublishToChannel(connection, entitlements)) return 'automatic';

  if (
    canUseChannelLevel(connection, entitlements, 'assisted_share') &&
    connection.capabilities.includes('assisted_share')
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
    connection.publicUrl &&
    !normalizeSafePublicChannelUrl(connection.publicUrl)
  ) {
    issues.push('public_url_must_be_safe_http_url');
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
