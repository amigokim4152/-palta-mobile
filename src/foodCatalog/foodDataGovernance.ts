import type {
  FoodOutletIdentity,
  FoodSourceEvidence,
  FoodSourceKind,
} from './foodCatalogModel.js';

export type FoodDataLayer =
  | 'research_observation'
  | 'independent_corroboration'
  | 'canonical_production';

export type FoodFactKind =
  | 'business_identity'
  | 'outlet_address'
  | 'public_contact'
  | 'menu_item_name'
  | 'menu_item_price'
  | 'opening_hours'
  | 'delivery_capability';

const RESEARCH_ONLY_SOURCES = new Set<FoodSourceKind>(['uber_eats']);

/**
 * Sources that are sufficiently independent from a delivery marketplace to
 * support Palta production facts when the specific fact is actually present
 * in that source. Another delivery marketplace (for example Rappi) is useful
 * corroboration, but is intentionally not enough by itself for production.
 */
const INDEPENDENT_PRODUCTION_SOURCES = new Set<FoodSourceKind>([
  'official_website',
  'official_social',
  'merchant_registration',
  'public_registry',
  'google_business',
  'waze',
  'other_public_source',
]);

export type FoodFactEvidenceSet = Readonly<{
  fact: FoodFactKind;
  evidence: readonly FoodSourceEvidence[];
}>;

export type FoodCanonicalPromotionDecision = Readonly<{
  allowed: boolean;
  layer: FoodDataLayer;
  reason:
    | 'independent_source_confirmed'
    | 'merchant_confirmed'
    | 'research_only_source'
    | 'identity_not_ready'
    | 'missing_independent_evidence';
}>;

export function isResearchOnlySource(kind: FoodSourceKind): boolean {
  return RESEARCH_ONLY_SOURCES.has(kind);
}

export function isIndependentProductionSource(kind: FoodSourceKind): boolean {
  return INDEPENDENT_PRODUCTION_SOURCES.has(kind);
}

export function hasIndependentProductionEvidence(
  evidence: readonly FoodSourceEvidence[],
): boolean {
  return evidence.some((item) => isIndependentProductionSource(item.kind));
}

export function hasMerchantEvidence(evidence: readonly FoodSourceEvidence[]): boolean {
  return evidence.some((item) => item.kind === 'merchant_registration');
}

/**
 * Outlet identity may enter the Palta canonical-candidate lane only when both
 * conditions are true:
 * 1) identity resolution reached verified/corroborated; and
 * 2) at least one production-eligible independent source supports the outlet.
 *
 * Delivery marketplaces can help discovery/corroboration, but cannot be the
 * only basis for creating a Palta production business/outlet.
 */
export function canPromoteOutletIdentity(outlet: FoodOutletIdentity): boolean {
  const identityReady =
    outlet.identityStatus === 'verified' || outlet.identityStatus === 'corroborated';
  return identityReady && hasIndependentProductionEvidence(outlet.evidence);
}

/**
 * Uber Eats and similar delivery-platform observations may be retained for
 * market research/taxonomy work, but they must not be the sole evidence used
 * to publish a Palta canonical fact.
 */
export function decideFoodFactPromotion(
  outlet: FoodOutletIdentity,
  factEvidence: FoodFactEvidenceSet,
): FoodCanonicalPromotionDecision {
  if (!canPromoteOutletIdentity(outlet)) {
    return {
      allowed: false,
      layer: 'research_observation',
      reason: 'identity_not_ready',
    };
  }

  if (hasMerchantEvidence(factEvidence.evidence)) {
    return {
      allowed: true,
      layer: 'canonical_production',
      reason: 'merchant_confirmed',
    };
  }

  if (hasIndependentProductionEvidence(factEvidence.evidence)) {
    return {
      allowed: true,
      layer: 'canonical_production',
      reason: 'independent_source_confirmed',
    };
  }

  if (
    factEvidence.evidence.length > 0 &&
    factEvidence.evidence.every((item) => isResearchOnlySource(item.kind))
  ) {
    return {
      allowed: false,
      layer: 'research_observation',
      reason: 'research_only_source',
    };
  }

  return {
    allowed: false,
    layer: 'independent_corroboration',
    reason: 'missing_independent_evidence',
  };
}

export function canPublishCurrentMenuPrice(
  outlet: FoodOutletIdentity,
  evidence: readonly FoodSourceEvidence[],
): boolean {
  return decideFoodFactPromotion(outlet, {
    fact: 'menu_item_price',
    evidence,
  }).allowed;
}
