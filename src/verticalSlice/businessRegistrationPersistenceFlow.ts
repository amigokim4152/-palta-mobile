import type { BusinessOnboardingDraft } from '../business/businessOnboarding.js';
import type {
  BusinessPromotionResult,
  BusinessRegistrationPersistenceResult,
} from '../adapters/supabaseBusinessOnboardingAdapter.js';
import type { ChileAdministrativeAreaRepository } from '../adapters/supabaseChileAdministrativeAreaAdapter.js';

export interface BusinessRegistrationPersistencePort {
  persistRegistration(input: {
    draft: BusinessOnboardingDraft;
    idempotencyKey: string;
    serviceAreaCodes?: readonly string[];
    source?: string;
  }): Promise<BusinessRegistrationPersistenceResult>;
  promoteRegistration(input: {
    registrationId: string;
    primaryComunaCode?: string;
  }): Promise<BusinessPromotionResult>;
}

export async function persistBusinessRegistrationWithCountryLayer(input: {
  draft: BusinessOnboardingDraft;
  idempotencyKey: string;
  source?: string;
  countryLayer: ChileAdministrativeAreaRepository;
  persistence: BusinessRegistrationPersistencePort;
}): Promise<BusinessRegistrationPersistenceResult> {
  const serviceAreaCodes = await input.countryLayer.resolveComunaCodes(
    input.draft.serviceAreaIds,
  );

  return input.persistence.persistRegistration({
    draft: input.draft,
    idempotencyKey: input.idempotencyKey,
    serviceAreaCodes,
    ...(input.source ? { source: input.source } : {}),
  });
}

export async function promoteBusinessRegistrationWithCountryLayer(input: {
  registrationId: string;
  primaryComunaRef?: string;
  countryLayer: ChileAdministrativeAreaRepository;
  persistence: BusinessRegistrationPersistencePort;
}): Promise<BusinessPromotionResult> {
  let primaryComunaCode: string | undefined;
  if (input.primaryComunaRef?.trim()) {
    const codes = await input.countryLayer.resolveComunaCodes([
      input.primaryComunaRef.trim(),
    ]);
    primaryComunaCode = codes[0];
    if (!primaryComunaCode) throw new Error('primary_comuna_unresolved');
  }

  return input.persistence.promoteRegistration({
    registrationId: input.registrationId,
    ...(primaryComunaCode ? { primaryComunaCode } : {}),
  });
}
