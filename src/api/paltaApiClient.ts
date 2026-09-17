import type { BusinessCapability } from '../business/businessActionPolicy.js';
import type {
  BusinessChannelProvider,
  PublicBusinessChannelLink,
} from '../business/businessChannelConnection.js';
import type { BusinessOperationalState } from '../business/businessOperationalState.js';
import type { OwnerPartnerActionClass } from '../business/ownerPartnerActions.js';

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type HomeApiItem = {
  id: string;
  kind: 'action' | 'status' | 'alert' | 'useful_today' | 'content';
  title: string;
  body?: string;
  source_domain: string;
  delivery: 'home' | 'home_notify' | 'urgent';
  care_track_id?: string;
  related_entity_id?: string;
};

export type HomeApiResponse = { generated_at?: string; items: HomeApiItem[] };

export type LocalSearchItem = {
  entity_id: string;
  entity_type: 'place' | 'business' | 'public_service' | 'event';
  name: string;
  category_key?: string;
  distance_m?: number;
  verification_status?: string;
  operational_state?: BusinessOperationalState;
  operational_confirmed_at?: string;
  next_open_at?: string;
  /** Exact public point is absent for area-only or hidden-location businesses. */
  location?: { lat: number; lng: number };
};

export type BusinessApiPostSummary = {
  id: string;
  title: string;
  body?: string;
  published_at?: string;
};

export type BusinessBasicPostsApiResponse = {
  business_id: string;
  items: BusinessApiPostSummary[];
};

export type BusinessBasicPostPublishInput = {
  title: string;
  body?: string;
  idempotencyKey?: string;
};

export type BusinessFollowedUpdateApiItem = {
  id: string;
  business_id: string;
  business_name: string;
  kind: 'post' | 'coupon';
  title: string;
  body?: string;
  occurred_at: string;
  expires_at?: string;
};

export type BusinessFollowedUpdatesApiResponse = {
  generated_at?: string;
  items: BusinessFollowedUpdateApiItem[];
};

export type BusinessBasicCouponApiItem = {
  id: string;
  title: string;
  description?: string;
  redemption_instruction?: string;
  audience: 'public' | 'followers';
  expires_at?: string;
};

export type BusinessBasicCouponsApiResponse = {
  business_id: string;
  items: BusinessBasicCouponApiItem[];
};

export type OwnerBusinessBasicCouponApiResponse = {
  business_id: string;
  coupon?: BusinessBasicCouponApiItem;
};

export type BusinessBasicCouponUpsertInput = {
  title: string;
  description?: string;
  redemptionInstruction?: string;
  audience: 'public' | 'followers';
  expiresAt: string;
};

export type BusinessApiDetail = {
  id: string;
  name: string;
  category_key?: string;
  verification_status: 'unverified' | 'claimed' | 'verified' | 'suspended';
  opening_status?: string;
  operational_state?: BusinessOperationalState;
  operational_confirmed_at?: string;
  next_open_at?: string;
  description?: string;
  hours_summary?: string;
  service_labels?: string[];
  service_area_labels?: string[];
  photo_urls?: string[];
  posts?: BusinessApiPostSummary[];
  enabled_capabilities?: BusinessCapability[];
  channel_links?: PublicBusinessChannelLink[];
  location?: { lat: number; lng: number };
  contact?: {
    phone?: string;
    whatsapp?: string;
    website?: string;
    instagram?: string;
  };
};

export type BusinessRelationshipApiResponse = {
  business_id: string;
  saved: boolean;
  following: boolean;
  regular_customer: boolean;
  updated_at?: string;
};

export type BusinessRelationshipUpdate = {
  saved?: boolean;
  following?: boolean;
};

export type OwnerBusinessGuidanceApiItem = {
  id: string;
  class: OwnerPartnerActionClass;
  title: string;
  reason: string;
  target: string;
  action_required: boolean;
  commercial: 'free' | 'may_be_paid' | 'unknown';
};

export type OwnerBusinessGuidanceApiResponse = {
  business_id: string;
  generated_at?: string;
  items: OwnerBusinessGuidanceApiItem[];
};

export type BusinessPublicChannelProvider = Exclude<BusinessChannelProvider, 'palta' | 'pos'>;

export type BusinessPublicChannelLinkInput = {
  provider: BusinessPublicChannelProvider;
  url: string;
};

export type BusinessPublicChannelLinksApiResponse = {
  business_id: string;
  links: PublicBusinessChannelLink[];
};

export type BusinessOnboardingApiInput = {
  mode: 'claim_existing' | 'create_new';
  businessId?: string;
  businessName: string;
  ownerDescription: string;
  confirmedServiceIds: readonly string[];
  presenceModes: readonly string[];
  serviceAreaIds: readonly string[];
  anchorLocation?: { lat: number; lng: number };
  addressLabel?: string;
  contact?: { phone?: string; whatsapp?: string };
  idempotencyKey?: string;
};
