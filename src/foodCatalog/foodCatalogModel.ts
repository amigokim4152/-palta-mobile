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
