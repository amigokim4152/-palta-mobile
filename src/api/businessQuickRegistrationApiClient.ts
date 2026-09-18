import type { FetchLike } from './paltaApiClient.js';

export type BusinessQuickRegistrationInput = {
  mode: 'create_new' | 'claim_existing';
  existingBusinessId?: string;
  businessName: string;
  ownerDescription: string;
  confirmedServiceIds: readonly string[];
  anchorLocation: { lat: number; lng: number };
  contact: { whatsapp?: string; phone?: string };
  idempotencyKey: string;
};

export type BusinessQuickRegistrationResult = {
  registration_id: string;
  status: 'pending_verification' | 'matched_existing';
  mode: 'create_new' | 'claim_existing';
  matched_business_id: string | null;
};

export async function submitBusinessQuickRegistration(input: {
  baseUrl: string;
  publicApiKey: string;
  fetch: FetchLike;
  registration: BusinessQuickRegistrationInput;
}): Promise<BusinessQuickRegistrationResult> {
  const baseUrl = input.baseUrl.replace(/\/$/, '');
  const registration = input.registration;
  const response = await input.fetch(`${baseUrl}/v1/business/quick-registration`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: input.publicApiKey,
      'Idempotency-Key': registration.idempotencyKey,
    },
    body: JSON.stringify({
      mode: registration.mode,
      ...(registration.existingBusinessId
        ? { existing_business_id: registration.existingBusinessId }
        : {}),
      business_name: registration.businessName,
      owner_description: registration.ownerDescription,
      confirmed_service_ids: [...registration.confirmedServiceIds],
      anchor_location: registration.anchorLocation,
      contact: registration.contact,
      idempotency_key: registration.idempotencyKey,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error ?? 'registration_failed')
      : `registration_failed_${response.status}`;
    throw new Error(error);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('quick_registration_invalid_response');
  }

  const result = payload as Record<string, unknown>;
  if (
    typeof result.registration_id !== 'string' ||
    typeof result.status !== 'string' ||
    typeof result.mode !== 'string'
  ) {
    throw new Error('quick_registration_invalid_response');
  }

  return result as BusinessQuickRegistrationResult;
}
