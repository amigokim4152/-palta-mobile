export type BusinessPresenceMode =
  | 'storefront'
  | 'customer_site'
  | 'mobile_event'
  | 'online'
  | 'mixed';

export type BusinessOnboardingMode =
  | 'undecided'
  | 'claim_existing'
  | 'create_new';

export type BusinessOnboardingStage =
  | 'find_business'
  | 'describe_services'
  | 'confirm_services'
  | 'service_mode'
  | 'public_profile'
  | 'verification'
  | 'ready';

export type OwnerVerificationStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'rejected';

export type GeoPoint = { lat: number; lng: number };

export type ExistingBusinessCandidate = {
  businessId: string;
  name: string;
  location?: GeoPoint;
  addressLabel?: string;
  distanceM?: number;
  alreadyClaimed: boolean;
};

export type ServiceSuggestion = {
  serviceId: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  matchedTerms: readonly string[];
};

export type BusinessPublicContact = { phone?: string; whatsapp?: string };

export type BusinessOnboardingDraft = {
  id: string;
  mode: BusinessOnboardingMode;
  stage: BusinessOnboardingStage;
  businessId?: string;
  businessName?: string;
  anchorLocation?: GeoPoint;
  addressLabel?: string;
  ownerDescription?: string;
  serviceSuggestions: readonly ServiceSuggestion[];
  confirmedServiceIds: readonly string[];
  presenceModes: readonly BusinessPresenceMode[];
  serviceAreaIds: readonly string[];
  publicContact: BusinessPublicContact;
  verificationStatus: OwnerVerificationStatus;
};

export type OnboardingReadiness = {
  readyForVerification: boolean;
  readyForPublish: boolean;
  missing: readonly string[];
};

export function createBusinessOnboardingDraft(id: string): BusinessOnboardingDraft {
  return {
    id,
    mode: 'undecided',
    stage: 'find_business',
    serviceSuggestions: [],
    confirmedServiceIds: [],
    presenceModes: [],
    serviceAreaIds: [],
    publicContact: {},
    verificationStatus: 'not_started',
  };
}

export function chooseExistingBusiness(
  draft: BusinessOnboardingDraft,
  candidate: ExistingBusinessCandidate,
): BusinessOnboardingDraft {
  if (candidate.alreadyClaimed) throw new Error('business_already_claimed');
  return {
    ...draft,
    mode: 'claim_existing',
    stage: 'describe_services',
    businessId: candidate.businessId,
    businessName: candidate.name,
    ...(candidate.location ? { anchorLocation: candidate.location } : {}),
    ...(candidate.addressLabel ? { addressLabel: candidate.addressLabel } : {}),
  };
}

export function startNewBusiness(
  draft: BusinessOnboardingDraft,
  input: { businessName: string; anchorLocation?: GeoPoint; addressLabel?: string },
): BusinessOnboardingDraft {
  const businessName = input.businessName.trim();
  if (!businessName) throw new Error('business_name_required');
  return {
    ...draft,
    mode: 'create_new',
    stage: 'describe_services',
    businessName,
    ...(input.anchorLocation ? { anchorLocation: input.anchorLocation } : {}),
    ...(input.addressLabel ? { addressLabel: input.addressLabel.trim() } : {}),
  };
}

export function describeBusinessServices(
  draft: BusinessOnboardingDraft,
  description: string,
): BusinessOnboardingDraft {
  const ownerDescription = description.trim();
  if (!ownerDescription) throw new Error('service_description_required');
  return {
    ...draft,
    ownerDescription,
    stage: 'confirm_services',
    serviceSuggestions: [],
    confirmedServiceIds: [],
  };
}

export function setServiceSuggestions(
  draft: BusinessOnboardingDraft,
  suggestions: readonly ServiceSuggestion[],
): BusinessOnboardingDraft {
  if (!draft.ownerDescription) throw new Error('service_description_required');
  const deduped = suggestions.filter(
    (item, index, all) => all.findIndex((candidate) => candidate.serviceId === item.serviceId) === index,
  );
  return { ...draft, serviceSuggestions: deduped.slice(0, 3) };
}

export function confirmBusinessServices(
  draft: BusinessOnboardingDraft,
  serviceIds: readonly string[],
): BusinessOnboardingDraft {
  const unique = [...new Set(serviceIds.map((item) => item.trim()).filter(Boolean))];
  if (unique.length === 0) throw new Error('confirmed_service_required');
  return { ...draft, confirmedServiceIds: unique, stage: 'service_mode' };
}

export function setBusinessPresence(
  draft: BusinessOnboardingDraft,
  input: {
    presenceModes: readonly BusinessPresenceMode[];
    serviceAreaIds?: readonly string[];
    anchorLocation?: GeoPoint;
    addressLabel?: string;
  },
): BusinessOnboardingDraft {
  const presenceModes = [...new Set(input.presenceModes)];
  if (presenceModes.length === 0) throw new Error('presence_mode_required');
  const serviceAreaIds = [...new Set((input.serviceAreaIds ?? []).map((item) => item.trim()).filter(Boolean))];
  const anchorLocation = input.anchorLocation ?? draft.anchorLocation;
  const needsStorefront = presenceModes.includes('storefront') || presenceModes.includes('mixed');
  const needsServiceArea = presenceModes.includes('customer_site') || presenceModes.includes('mobile_event') || presenceModes.includes('mixed');
  if (needsStorefront && !anchorLocation) throw new Error('storefront_location_required');
  if (needsServiceArea && serviceAreaIds.length === 0) throw new Error('service_area_required');
  return {
    ...draft,
    presenceModes,
    serviceAreaIds,
    ...(anchorLocation ? { anchorLocation } : {}),
    ...(input.addressLabel ? { addressLabel: input.addressLabel.trim() } : {}),
    stage: 'public_profile',
  };
}

export function setBusinessPublicContact(
  draft: BusinessOnboardingDraft,
  contact: BusinessPublicContact,
): BusinessOnboardingDraft {
  const phone = contact.phone?.trim();
  const whatsapp = contact.whatsapp?.trim();
  return {
    ...draft,
    publicContact: {
      ...(phone ? { phone } : {}),
      ...(whatsapp ? { whatsapp } : {}),
    },
  };
}

export function evaluateOnboardingReadiness(draft: BusinessOnboardingDraft): OnboardingReadiness {
  const missing: string[] = [];
  if (draft.mode === 'undecided') missing.push('business_match_or_create');
  if (!draft.businessName?.trim()) missing.push('business_name');
  if (!draft.ownerDescription?.trim()) missing.push('service_description');
  if (draft.confirmedServiceIds.length === 0) missing.push('confirmed_service');
  if (draft.presenceModes.length === 0) missing.push('presence_mode');
  const needsStorefront = draft.presenceModes.includes('storefront') || draft.presenceModes.includes('mixed');
  const needsServiceArea = draft.presenceModes.includes('customer_site') || draft.presenceModes.includes('mobile_event') || draft.presenceModes.includes('mixed');
  if (needsStorefront && !draft.anchorLocation) missing.push('storefront_location');
  if (needsServiceArea && draft.serviceAreaIds.length === 0) missing.push('service_area');
  const readyForVerification = missing.length === 0;
  return {
    readyForVerification,
    readyForPublish: readyForVerification && draft.verificationStatus === 'verified',
    missing,
  };
}

export function requestOwnerVerification(draft: BusinessOnboardingDraft): BusinessOnboardingDraft {
  const readiness = evaluateOnboardingReadiness(draft);
  if (!readiness.readyForVerification) {
    throw new Error(`onboarding_incomplete:${readiness.missing.join(',')}`);
  }
  return { ...draft, verificationStatus: 'pending', stage: 'verification' };
}

export function markOwnerVerified(draft: BusinessOnboardingDraft): BusinessOnboardingDraft {
  if (draft.verificationStatus !== 'pending') throw new Error('verification_not_pending');
  return { ...draft, verificationStatus: 'verified', stage: 'ready' };
}
