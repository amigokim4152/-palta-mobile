import {
  evaluateOnboardingReadiness,
  type BusinessOnboardingDraft,
  type BusinessPresenceMode,
} from '../business/businessOnboarding.js';
import type { ServerFetch } from './supabaseLocalBusinessDiscoveryAdapter.js';

export type BusinessPublicLocationPrecision = 'exact' | 'area_only' | 'hidden';

export type BusinessRegistrationPersistenceInput = Readonly<{
  draft: BusinessOnboardingDraft;
  idempotencyKey: string;
  /**
   * Official Chile administrative codes resolved by the Country Layer.
   * Do not pass UI slugs such as "vitacura" unless the Country Layer has
   * explicitly declared that value to be the canonical code.
   */
  serviceAreaCodes?: readonly string[];
  source?: string;
}>;

export type BusinessRegistrationPersistenceResult = Readonly<{
  registrationId: string;
  status: string;
  resolvedMode: 'create_new' | 'claim_existing';
  matchedBusinessId?: string;
}>;

export type BusinessPromotionResult = Readonly<{
  businessId?: string;
  status: string;
  created: boolean;
}>;

export type SupabaseBusinessOnboardingAdapterOptions = Readonly<{
  projectUrl: string;
  serviceRoleKey: string;
  fetch: ServerFetch;
}>;

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean || undefined;
}

function uniqueClean(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((item) => item.trim()).filter(Boolean))];
}

function hasAny(modes: readonly BusinessPresenceMode[], candidates: readonly BusinessPresenceMode[]): boolean {
  return candidates.some((candidate) => modes.includes(candidate));
}

export function deriveBusinessPublicLocationPrecision(
  presenceModes: readonly BusinessPresenceMode[],
): BusinessPublicLocationPrecision {
  if (hasAny(presenceModes, ['storefront', 'mixed'])) return 'exact';
  if (hasAny(presenceModes, ['customer_site', 'mobile_event'])) return 'area_only';
  if (presenceModes.includes('online')) return 'hidden';
  throw new Error('business_presence_mode_required');
}

function normalizeRegistrationResult(payload: unknown): BusinessRegistrationPersistenceResult {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('business_intake_invalid_payload');
  }
  const row = record(payload[0]);
  const registrationId = text(row?.registration_id);
  const status = text(row?.registration_status);
  const resolvedMode = text(row?.resolved_mode);
  if (!registrationId || !status || (resolvedMode !== 'create_new' && resolvedMode !== 'claim_existing')) {
    throw new Error('business_intake_invalid_payload');
  }
  const matchedBusinessId = text(row?.matched_business_id);
  return {
    registrationId,
    status,
    resolvedMode,
    ...(matchedBusinessId ? { matchedBusinessId } : {}),
  };
}

function normalizePromotionResult(payload: unknown): BusinessPromotionResult {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('business_promotion_invalid_payload');
  }
  const row = record(payload[0]);
  const status = text(row?.result_status);
  if (!status || typeof row?.created !== 'boolean') {
    throw new Error('business_promotion_invalid_payload');
  }
  const businessId = text(row.business_id);
  return {
    ...(businessId ? { businessId } : {}),
    status,
    created: row.created,
  };
}

/**
 * Trusted-backend adapter for the 3-minute owner registration flow.
 * Service-role credentials must stay in Palta API/Worker infrastructure and
 * must never be bundled into Expo/mobile code.
 */
export class SupabaseBusinessOnboardingAdapter {
  private readonly projectUrl: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: ServerFetch;

  constructor(options: SupabaseBusinessOnboardingAdapterOptions) {
    const projectUrl = options.projectUrl.trim().replace(/\/$/, '');
    const serviceRoleKey = options.serviceRoleKey.trim();
    if (!/^https:\/\//.test(projectUrl)) throw new Error('invalid_supabase_project_url');
    if (!serviceRoleKey) throw new Error('missing_supabase_service_role_key');
    this.projectUrl = projectUrl;
    this.serviceRoleKey = serviceRoleKey;
    this.fetchImpl = options.fetch;
  }

  private async rpc(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(`${this.projectUrl}/rest/v1/rpc/${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${path}_failed:${response.status}`);
    return response.json();
  }

  async persistRegistration(
    input: BusinessRegistrationPersistenceInput,
  ): Promise<BusinessRegistrationPersistenceResult> {
    const readiness = evaluateOnboardingReadiness(input.draft);
    if (!readiness.readyForVerification) {
      throw new Error(`business_onboarding_incomplete:${readiness.missing.join(',')}`);
    }
    if (input.draft.mode !== 'create_new' && input.draft.mode !== 'claim_existing') {
      throw new Error('business_onboarding_mode_required');
    }

    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey || idempotencyKey.length > 160) {
      throw new Error('invalid_business_intake_idempotency_key');
    }

    const serviceAreaCodes = uniqueClean(input.serviceAreaCodes);
    if (input.draft.serviceAreaIds.length > 0 && serviceAreaCodes.length === 0) {
      throw new Error('service_area_codes_unresolved');
    }

    const publicLocationPrecision = deriveBusinessPublicLocationPrecision(input.draft.presenceModes);
    const anchor = input.draft.anchorLocation;
    if (publicLocationPrecision === 'exact' && !anchor) {
      throw new Error('exact_business_location_required');
    }

    const payload = await this.rpc('palta_create_business_intake_v2', {
      p_mode: input.draft.mode,
      p_existing_business_id: input.draft.mode === 'claim_existing' ? input.draft.businessId ?? null : null,
      p_business_name: input.draft.businessName?.trim() ?? '',
      p_owner_description: input.draft.ownerDescription?.trim() ?? '',
      p_confirmed_service_ids: [...input.draft.confirmedServiceIds],
      p_lat: anchor?.lat ?? null,
      p_lng: anchor?.lng ?? null,
      p_whatsapp: input.draft.publicContact.whatsapp?.trim() || null,
      p_phone: input.draft.publicContact.phone?.trim() || null,
      p_source: input.source?.trim() || 'palta_api',
      p_idempotency_key: idempotencyKey,
      p_presence_modes: [...input.draft.presenceModes],
      p_service_area_codes: serviceAreaCodes,
      p_address_label: input.draft.addressLabel?.trim() || null,
      p_public_location_precision: publicLocationPrecision,
    });

    return normalizeRegistrationResult(payload);
  }

  /**
   * Promotion is intentionally separate from intake. Call only after Palta's
   * verification/anti-abuse gate has approved canonical creation.
   */
  async promoteRegistration(input: {
    registrationId: string;
    primaryComunaCode?: string;
  }): Promise<BusinessPromotionResult> {
    const registrationId = input.registrationId.trim();
    if (!registrationId) throw new Error('business_registration_id_required');
    const payload = await this.rpc('palta_promote_business_intake', {
      p_registration_id: registrationId,
      p_comuna_code: input.primaryComunaCode?.trim() || null,
    });
    return normalizePromotionResult(payload);
  }
}
