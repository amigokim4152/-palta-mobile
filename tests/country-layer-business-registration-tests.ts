import type { BusinessOnboardingDraft } from '../src/business/businessOnboarding.js';
import type {
  ChileAdministrativeAreaRepository,
  ChileComunaMatch,
} from '../src/adapters/supabaseChileAdministrativeAreaAdapter.js';
import type {
  BusinessRegistrationPersistencePort,
} from '../src/verticalSlice/businessRegistrationPersistenceFlow.js';
import {
  persistBusinessRegistrationWithCountryLayer,
  promoteBusinessRegistrationWithCountryLayer,
} from '../src/verticalSlice/businessRegistrationPersistenceFlow.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function onboardingDraft(): BusinessOnboardingDraft {
  return {
    id: 'draft-country-layer',
    mode: 'create_new',
    stage: 'public_profile',
    businessName: 'Servicio Palta',
    ownerDescription: 'Servicio a domicilio en el sector oriente',
    serviceSuggestions: [],
    confirmedServiceIds: ['home_service'],
    presenceModes: ['customer_site'],
    serviceAreaIds: ['vitacura', 'las-condes'],
    publicContact: { whatsapp: '+56911111111' },
    verificationStatus: 'not_started',
  };
}

const resolvedCalls: string[][] = [];
const mapping: Record<string, ChileComunaMatch> = {
  vitacura: { inputRef: 'vitacura', code: '13132', name: 'Vitacura', slug: 'vitacura' },
  'las-condes': { inputRef: 'las-condes', code: '13114', name: 'Las Condes', slug: 'las-condes' },
  providencia: { inputRef: 'providencia', code: '13123', name: 'Providencia', slug: 'providencia' },
};

const countryLayer: ChileAdministrativeAreaRepository = {
  async resolveComunas(refs) {
    resolvedCalls.push([...refs]);
    return refs.map((ref) => mapping[ref]).filter((item): item is ChileComunaMatch => Boolean(item));
  },
  async resolveComunaCodes(refs) {
    resolvedCalls.push([...refs]);
    return refs.map((ref) => {
      const match = mapping[ref];
      if (!match) throw new Error(`unresolved_comuna_ref:${ref}`);
      return match.code;
    });
  },
};

const persistedInputs: Array<{
  idempotencyKey: string;
  serviceAreaCodes?: readonly string[];
  source?: string;
}> = [];
const promotedInputs: Array<{
  registrationId: string;
  primaryComunaCode?: string;
}> = [];

const persistence: BusinessRegistrationPersistencePort = {
  async persistRegistration(input) {
    persistedInputs.push({
      idempotencyKey: input.idempotencyKey,
      ...(input.serviceAreaCodes ? { serviceAreaCodes: [...input.serviceAreaCodes] } : {}),
      ...(input.source ? { source: input.source } : {}),
    });
    return {
      registrationId: 'reg-1',
      status: 'pending_verification',
      resolvedMode: 'create_new',
    };
  },
  async promoteRegistration(input) {
    promotedInputs.push({
      registrationId: input.registrationId,
      ...(input.primaryComunaCode ? { primaryComunaCode: input.primaryComunaCode } : {}),
    });
    return { businessId: 'biz-1', status: 'approved', created: true };
  },
};

const persisted = await persistBusinessRegistrationWithCountryLayer({
  draft: onboardingDraft(),
  idempotencyKey: 'country-flow-1',
  source: 'pwa_quick',
  countryLayer,
  persistence,
});
assert(persisted.registrationId === 'reg-1', 'Country Layer handoff must preserve registration identity.');
assert(resolvedCalls[0]?.join('|') === 'vitacura|las-condes', 'Draft service-area refs must resolve before persistence.');
assert(
  persistedInputs[0]?.serviceAreaCodes?.join('|') === '13132|13114',
  'Persistence must receive official CUT codes, never UI slugs.',
);
assert(persistedInputs[0]?.source === 'pwa_quick', 'Registration source must survive the Country Layer handoff.');

const promoted = await promoteBusinessRegistrationWithCountryLayer({
  registrationId: 'reg-1',
  primaryComunaRef: 'providencia',
  countryLayer,
  persistence,
});
assert(promoted.businessId === 'biz-1', 'Promotion must preserve canonical Business identity.');
assert(
  promotedInputs[0]?.primaryComunaCode === '13123',
  'Promotion must resolve the primary comuna reference to official CUT first.',
);

let unresolvedBlocked = false;
try {
  await persistBusinessRegistrationWithCountryLayer({
    draft: { ...onboardingDraft(), serviceAreaIds: ['unknown-comuna'] },
    idempotencyKey: 'country-flow-2',
    countryLayer,
    persistence,
  });
} catch (error) {
  unresolvedBlocked = error instanceof Error && error.message === 'unresolved_comuna_ref:unknown-comuna';
}
assert(unresolvedBlocked, 'Unknown comuna refs must block persistence instead of becoming bad canonical data.');
assert(persistedInputs.length === 1, 'Blocked Country Layer resolution must not reach persistence.');

console.log('PASS: Country Layer -> Local Business registration handoff');
