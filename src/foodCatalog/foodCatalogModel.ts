export type FoodEvidenceStatus =
  | 'verified'
  | 'corroborated'
  | 'platform_only'
  | 'needs_review'
  | 'possible_virtual_brand';

export type FoodSourceKind =
  | 'uber_eats'
  | 'official_website'
  | 'official_social'
  | 'merchant_registration'
  | 'public_registry'
  | 'rappi'
  | 'google_business'
  | 'waze'
  | 'other_public_source';

export type FoodSourceEvidence = Readonly<{
  kind: FoodSourceKind;
  url: string;
  observedAt: string;
  sourceListingId?: string;
}>;

export type PublicBusinessContact = Readonly<{
  phone?: string;
  whatsapp?: string;
  website?: string;
}>;

export type FoodOutletIdentity = Readonly<{
  outletKey: string;
  brandName: string;
  outletName?: string;
  /** Resolved/corroborated outlet address candidate, not blindly copied platform text. */
  address?: string;
  comuna?: string;
  region?: string;
  postalCode?: string;
  location?: { lat: number; lng: number };
  publicContact?: PublicBusinessContact;
  identityStatus: FoodEvidenceStatus;
  identityNote?: string;
  evidence: readonly FoodSourceEvidence[];
}>;

/**
 * Evidence overlay collected after the raw delivery-platform observation.
 * This stays separate from the raw snapshot so source facts can always be
 * audited and reprocessed when identity rules evolve.
 */
export type FoodOutletCorroboration = Readonly<{
  outletKey: string;
  identityStatus: Exclude<FoodEvidenceStatus, 'platform_only'>;
  address?: string;
  comuna?: string;
  region?: string;
  postalCode?: string;
  location?: { lat: number; lng: number };
  publicContact?: PublicBusinessContact;
  identityNote?: string;
  evidence: readonly FoodSourceEvidence[];
}>;

export type PlatformFoodListing = Readonly<{
  platform: 'uber_eats' | 'rappi' | 'other';
  listingId: string;
  outletKey: string;
  listingName: string;
  /** Preserve platform-exposed location text separately when it may conflict with outlet truth. */
  sourceAddress?: string;
  sourceComuna?: string;
  sourcePostalCode?: string;
  platformCategories: readonly string[];
  deliveryAvailable?: boolean;
  pickupAvailable?: boolean;
  scheduledOrdersAvailable?: boolean;
  observedAvailability?: 'available' | 'temporarily_unavailable' | 'closed_on_platform';
  closedOnPlatformAt?: string;
  observedHours?: readonly string[];
  source: FoodSourceEvidence;
}>;

/**
 * A physical outlet can acquire more than one platform listing over time. Keep
 * the current listing and historical/replaced listings attached to the same
 * outlet rather than creating duplicate canonical businesses.
 */
export type FoodOutletPlatformPresence = Readonly<{
  outletKey: string;
  currentListing?: PlatformFoodListing;
  relatedListings: readonly PlatformFoodListing[];
}>;

export type RawMenuItem = Readonly<{
  sourceItemName: string;
  /** Current observed sell price. Never assume it is permanent. */
  priceClp?: number;
  /** Optional crossed-out/reference price when the platform exposes a promotion. */
  referencePriceClp?: number;
  promotionLabel?: string;
  sourceSectionName?: string;
  available?: boolean;
  popularityHint?: string;
}>;

export type RawMenuSection = Readonly<{
  sourceSectionName: string;
  items: readonly RawMenuItem[];
}>;

export type FoodMenuSnapshot = Readonly<{
  listingId: string;
  outletKey: string;
  observedAt: string;
  currency: 'CLP';
  sections: readonly RawMenuSection[];
}>;

export type DishFamily =
  | 'completo_hotdog'
  | 'sandwich'
  | 'burger'
  | 'pizza'
  | 'sushi_roll'
  | 'chicken'
  | 'rice_dish'
  | 'noodle_dish'
  | 'soup_stew'
  | 'seafood'
  | 'empanada_pastry'
  | 'salad_bowl'
  | 'fries_side'
  | 'bakery'
  | 'dessert'
  | 'ice_cream'
  | 'coffee_tea'
  | 'beverage'
  | 'other';

export type CuisineTag =
  | 'chilean'
  | 'peruvian'
  | 'japanese'
  | 'korean'
  | 'chinese'
  | 'american'
  | 'italian'
  | 'mexican'
  | 'venezuelan'
  | 'middle_eastern'
  | 'indian'
  | 'latin_american'
  | 'other';

export type ServingFormat =
  | 'single'
  | 'combo'
  | 'share'
  | 'family'
  | 'promotion'
  | 'meal_deal'
  | 'by_weight'
  | 'unknown';

export type NormalizedFoodItem = Readonly<{
  listingId: string;
  outletKey: string;
  sourceItemName: string;
  sourceSectionName?: string;
  dishFamily: DishFamily;
  cuisineTags: readonly CuisineTag[];
  servingFormat: ServingFormat;
  canonicalDishName?: string;
  confidence: 'high' | 'medium' | 'low';
}>;

function evidenceKey(input: FoodSourceEvidence): string {
  return `${input.kind}|${input.url}|${input.sourceListingId ?? ''}`;
}

function mergeEvidence(
  source: readonly FoodSourceEvidence[],
  overlay: readonly FoodSourceEvidence[],
): readonly FoodSourceEvidence[] {
  const merged = new Map<string, FoodSourceEvidence>();
  for (const evidence of [...source, ...overlay]) merged.set(evidenceKey(evidence), evidence);
  return [...merged.values()];
}

function mergePublicContact(
  source: PublicBusinessContact | undefined,
  overlay: PublicBusinessContact | undefined,
): PublicBusinessContact | undefined {
  const merged = { ...(source ?? {}), ...(overlay ?? {}) };
  return Object.keys(merged).length ? merged : undefined;
}

/**
 * Build the best currently supported outlet projection while preserving the raw
 * observation separately. Corroboration can improve identity/contact fields but
 * cannot silently change the outlet key or brand identity.
 */
export function applyOutletCorroboration(
  source: FoodOutletIdentity,
  corroboration: FoodOutletCorroboration | undefined,
): FoodOutletIdentity {
  if (!corroboration) return source;
  if (corroboration.outletKey !== source.outletKey) {
    throw new Error('food_outlet_corroboration_key_mismatch');
  }

  const address = corroboration.address ?? source.address;
  const comuna = corroboration.comuna ?? source.comuna;
  const region = corroboration.region ?? source.region;
  const postalCode = corroboration.postalCode ?? source.postalCode;
  const location = corroboration.location ?? source.location;
  const publicContact = mergePublicContact(source.publicContact, corroboration.publicContact);
  const identityNote = corroboration.identityNote ?? source.identityNote;

  return {
    ...source,
    ...(address !== undefined ? { address } : {}),
    ...(comuna !== undefined ? { comuna } : {}),
    ...(region !== undefined ? { region } : {}),
    ...(postalCode !== undefined ? { postalCode } : {}),
    ...(location !== undefined ? { location } : {}),
    ...(publicContact !== undefined ? { publicContact } : {}),
    identityStatus: corroboration.identityStatus,
    ...(identityNote !== undefined ? { identityNote } : {}),
    evidence: mergeEvidence(source.evidence, corroboration.evidence),
  };
}

/**
 * Platform categories are evidence, never the Palta taxonomy itself.
 * Palta keeps source facts intact and stores normalization as a separate layer.
 */
export function platformCategoriesAreCanonical(): false {
  return false;
}

export function outletCanEnterCanonicalBusiness(input: FoodOutletIdentity): boolean {
  return input.identityStatus === 'verified' || input.identityStatus === 'corroborated';
}

export function requiresIdentityReview(input: FoodOutletIdentity): boolean {
  return input.identityStatus === 'needs_review' || input.identityStatus === 'possible_virtual_brand';
}

export function normalizePublicPhone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('56')) return `+${digits}`;
  if (digits.length === 9 && digits.startsWith('9')) return `+56${digits}`;
  return trimmed.startsWith('+') ? `+${digits}` : trimmed;
}
