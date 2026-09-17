import type { ServiceResolverEntry, ServiceResolution } from './serviceResolver.js';
import { resolveServiceSuggestions } from './serviceResolver.js';

export type BusinessServiceProfile = Readonly<{
  businessId: string;
  canonicalServiceIds: readonly string[];
  pendingOwnerPhrases: readonly string[];
  updatedAt?: string;
}>;

export type BusinessServiceSuggestion = Readonly<{
  serviceId: string;
  discoveryGroupKey: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
}>;

export type BusinessServiceEditResult = Readonly<{
  profile: BusinessServiceProfile;
  changed: boolean;
}>;

const MAX_CANONICAL_SERVICES = 12;
const MAX_PENDING_PHRASES = 5;
const MAX_PENDING_PHRASE_LENGTH = 120;

function normalizePhrase(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validateBusinessServiceProfile(
  profile: BusinessServiceProfile,
  catalog: readonly ServiceResolverEntry[],
): readonly string[] {
  const issues: string[] = [];
  if (!profile.businessId.trim()) issues.push('business_id_required');

  const canonical = profile.canonicalServiceIds.map((id) => id.trim()).filter(Boolean);
  if (canonical.length !== new Set(canonical).size) issues.push('duplicate_canonical_service');
  if (canonical.length > MAX_CANONICAL_SERVICES) issues.push('canonical_service_limit_exceeded');

  const knownIds = new Set(catalog.map((entry) => entry.serviceId));
  if (canonical.some((id) => !knownIds.has(id))) issues.push('unknown_canonical_service');

  const pending = profile.pendingOwnerPhrases.map(normalizePhrase).filter(Boolean);
  if (pending.length !== new Set(pending.map((item) => item.toLocaleLowerCase('es-CL'))).size) {
    issues.push('duplicate_pending_phrase');
  }
  if (pending.length > MAX_PENDING_PHRASES) issues.push('pending_phrase_limit_exceeded');
  if (pending.some((item) => item.length > MAX_PENDING_PHRASE_LENGTH)) {
    issues.push('pending_phrase_too_long');
  }

  return [...new Set(issues)];
}

export function suggestBusinessServices(
  ownerWords: string,
  catalog: readonly ServiceResolverEntry[],
  currentDiscoveryGroupKeys: readonly string[] = [],
): readonly BusinessServiceSuggestion[] {
  return resolveServiceSuggestions(ownerWords, catalog, {
    preferredDiscoveryGroupKeys: currentDiscoveryGroupKeys,
  }).suggestions.map((item: ServiceResolution) => ({
    serviceId: item.serviceId,
    discoveryGroupKey: item.discoveryGroupKey,
    label: item.label,
    confidence: item.confidence,
  }));
}

export function addCanonicalBusinessService(
  profile: BusinessServiceProfile,
  serviceId: string,
  catalog: readonly ServiceResolverEntry[],
): BusinessServiceEditResult {
  const cleanId = serviceId.trim();
  const known = catalog.some((entry) => entry.serviceId === cleanId);
  if (!known) throw new Error('unknown_canonical_service');
  if (profile.canonicalServiceIds.includes(cleanId)) return { profile, changed: false };
  if (profile.canonicalServiceIds.length >= MAX_CANONICAL_SERVICES) {
    throw new Error('canonical_service_limit_exceeded');
  }

  return {
    profile: {
      ...profile,
      canonicalServiceIds: [...profile.canonicalServiceIds, cleanId],
    },
    changed: true,
  };
}

export function removeCanonicalBusinessService(
  profile: BusinessServiceProfile,
  serviceId: string,
): BusinessServiceEditResult {
  if (!profile.canonicalServiceIds.includes(serviceId)) return { profile, changed: false };
  return {
    profile: {
      ...profile,
      canonicalServiceIds: profile.canonicalServiceIds.filter((id) => id !== serviceId),
    },
    changed: true,
  };
}

export function addPendingBusinessServicePhrase(
  profile: BusinessServiceProfile,
  ownerWords: string,
): BusinessServiceEditResult {
  const phrase = normalizePhrase(ownerWords);
  if (!phrase) throw new Error('pending_phrase_required');
  if (phrase.length > MAX_PENDING_PHRASE_LENGTH) throw new Error('pending_phrase_too_long');
  const duplicate = profile.pendingOwnerPhrases.some(
    (item) => normalizePhrase(item).toLocaleLowerCase('es-CL') === phrase.toLocaleLowerCase('es-CL'),
  );
  if (duplicate) return { profile, changed: false };
  if (profile.pendingOwnerPhrases.length >= MAX_PENDING_PHRASES) {
    throw new Error('pending_phrase_limit_exceeded');
  }
  return {
    profile: {
      ...profile,
      pendingOwnerPhrases: [...profile.pendingOwnerPhrases, phrase],
    },
    changed: true,
  };
}
