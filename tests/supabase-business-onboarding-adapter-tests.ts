import {
  SupabaseBusinessOnboardingAdapter,
  deriveBusinessPublicLocationPrecision,
} from '../src/adapters/supabaseBusinessOnboardingAdapter.js';
import type { BusinessOnboardingDraft } from '../src/business/businessOnboarding.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function draft(overrides: Partial<BusinessOnboardingDraft> = {}): BusinessOnboardingDraft {
  return {
    id: 'draft-1',
    mode: 'create_new',
    stage: 'public_profile',
    businessName: 'Panadería Palta',
    ownerDescription: 'Pan, empanadas y pastelería',
    anchorLocation: { lat: -33.3908, lng: -70.5707 },
    addressLabel: 'Vitacura, Santiago',
    serviceSuggestions: [],
    confirmedServiceIds: ['bakery'],
    presenceModes: ['storefront'],
    serviceAreaIds: [],
    publicContact: { whatsapp: '+56911111111' },
    verificationStatus: 'not_started',
    ...overrides,
  };
}

function draftWithoutLocation(
  overrides: Partial<BusinessOnboardingDraft> = {},
): BusinessOnboardingDraft {
  const { anchorLocation: _anchor, addressLabel: _address, ...base } = draft();
  return { ...base, ...overrides };
}

assert(deriveBusinessPublicLocationPrecision(['storefront']) === 'exact', 'storefront must persist an exact public point');
assert(deriveBusinessPublicLocationPrecision(['mixed']) === 'exact', 'mixed includes a storefront and must preserve its public point');
assert(deriveBusinessPublicLocationPrecision(['customer_site']) === 'area_only', 'customer-site work must not create a fake storefront pin');
assert(deriveBusinessPublicLocationPrecision(['mobile_event']) === 'area_only', 'mobile-event work must use broad area discovery');
assert(deriveBusinessPublicLocationPrecision(['online']) === 'hidden', 'online-only businesses must not fabricate a local point');

const calls: Array<{
  input: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}> = [];
const secret = 'service-role-onboarding-secret';
const adapter = new SupabaseBusinessOnboardingAdapter({
  projectUrl: 'https://example.supabase.co/',
  serviceRoleKey: secret,
  fetch: async (input, init) => {
    calls.push({ input, ...(init ? { init } : {}) });
    if (input.endsWith('/palta_promote_business_intake')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return [{ business_id: 'biz-1', result_status: 'approved', created: true }];
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return [{
          registration_id: 'reg-1',
          registration_status: 'pending_verification',
          resolved_mode: 'create_new',
          matched_business_id: null,
        }];
      },
    };
  },
});

const mixed = draft({
  presenceModes: ['mixed'],
  serviceAreaIds: ['vitacura'],
});
const persisted = await adapter.persistRegistration({
  draft: mixed,
  idempotencyKey: 'owner-device-request-1',
  serviceAreaCodes: ['13132'],
  source: 'pwa_quick',
});
assert(persisted.registrationId === 'reg-1', 'Intake response must normalize the canonical registration id.');
assert(calls.length === 1, 'Registration must issue one RPC request.');
const intakeCall = calls[0];
assert(intakeCall?.input.endsWith('/rest/v1/rpc/palta_create_business_intake_v2'), 'Onboarding must use only the v2 canonical intake RPC.');
const intakeBody = JSON.parse(intakeCall?.init?.body ?? '{}') as Record<string, unknown>;
assert(intakeBody.p_public_location_precision === 'exact', 'Mixed storefront must persist exact public precision.');
assert(intakeBody.p_lat === -33.3908 && intakeBody.p_lng === -70.5707, 'Confirmed storefront point must be preserved.');
assert(Array.isArray(intakeBody.p_service_area_codes) && intakeBody.p_service_area_codes[0] === '13132', 'Country Layer official code must be persisted instead of UI slug.');
assert(intakeCall?.init?.headers?.Authorization === `Bearer ${secret}`, 'Only the trusted backend may authenticate the persistence RPC.');

let unresolvedRejected = false;
try {
  await adapter.persistRegistration({
    draft: draftWithoutLocation({
      presenceModes: ['customer_site'],
      serviceAreaIds: ['providencia'],
    }),
    idempotencyKey: 'owner-device-request-2',
  });
} catch (error) {
  unresolvedRejected = error instanceof Error && error.message === 'service_area_codes_unresolved';
}
assert(unresolvedRejected, 'Unresolved UI service-area ids must never be written as official comuna codes.');
assert(calls.length === 1, 'Unresolved service areas must fail before hitting Supabase.');

let malformedCodeRejected = false;
try {
  await adapter.persistRegistration({
    draft: mixed,
    idempotencyKey: 'owner-device-request-bad-code',
    serviceAreaCodes: ['vitacura'],
  });
} catch (error) {
  malformedCodeRejected = error instanceof Error && error.message === 'invalid_service_area_code';
}
assert(malformedCodeRejected, 'Only official five-digit Chile area codes may cross the persistence boundary.');
assert(calls.length === 1, 'Malformed area codes must fail before hitting Supabase.');

const online = draftWithoutLocation({
  businessName: 'Asesoría Remota Palta',
  ownerDescription: 'Asesoría profesional remota',
  confirmedServiceIds: ['professional_service'],
  presenceModes: ['online'],
  serviceAreaIds: [],
});
await adapter.persistRegistration({
  draft: online,
  idempotencyKey: 'owner-device-request-3',
});
const onlineBody = JSON.parse(calls[1]?.init?.body ?? '{}') as Record<string, unknown>;
assert(onlineBody.p_public_location_precision === 'hidden', 'Online-only business must persist hidden location precision.');
assert(onlineBody.p_lat === null && onlineBody.p_lng === null, 'Online-only business must work without fabricated GPS.');

const promoted = await adapter.promoteRegistration({ registrationId: 'reg-1', primaryComunaCode: '13132' });
assert(promoted.businessId === 'biz-1' && promoted.created, 'Promotion response must return canonical business identity.');
const promoteBody = JSON.parse(calls[2]?.init?.body ?? '{}') as Record<string, unknown>;
assert(promoteBody.p_registration_id === 'reg-1', 'Promotion must reference the immutable intake id.');
assert(promoteBody.p_comuna_code === '13132', 'Primary official comuna code must be explicit at promotion.');

let badPrimaryComunaRejected = false;
try {
  await adapter.promoteRegistration({ registrationId: 'reg-1', primaryComunaCode: 'vitacura' });
} catch (error) {
  badPrimaryComunaRejected = error instanceof Error && error.message === 'invalid_comuna_code';
}
assert(badPrimaryComunaRejected, 'Promotion must reject a UI slug in place of an official comuna code.');
assert(Number(calls.length) === 3, 'Invalid primary comuna code must fail before hitting Supabase.');

const failing = new SupabaseBusinessOnboardingAdapter({
  projectUrl: 'https://example.supabase.co',
  serviceRoleKey: secret,
  fetch: async () => ({ ok: false, status: 503, async json() { return {}; } }),
});
let safeFailure = false;
try {
  await failing.persistRegistration({ draft: draft(), idempotencyKey: 'request-failure' });
} catch (error) {
  safeFailure = error instanceof Error
    && error.message === 'palta_create_business_intake_v2_failed:503'
    && !error.message.includes(secret);
}
assert(safeFailure, 'Persistence backend errors must not leak the service-role credential.');

console.log('PASS: Supabase Business onboarding persistence boundary');
