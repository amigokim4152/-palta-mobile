import {
  confirmBusinessServices,
  createBusinessOnboardingDraft,
  describeBusinessServices,
  evaluateOnboardingReadiness,
  setBusinessPresence,
  startNewBusiness,
} from '../src/business/businessOnboarding.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function preparedDraft(id: string) {
  let draft = createBusinessOnboardingDraft(id);
  draft = startNewBusiness(draft, { businessName: 'Servicio ejemplo' });
  draft = describeBusinessServices(draft, 'Gasfitería y reparaciones a domicilio');
  draft = confirmBusinessServices(draft, ['home.plumbing.general']);
  return draft;
}

const customerSite = setBusinessPresence(preparedDraft('no-gps-customer-site'), {
  presenceModes: ['customer_site'],
  serviceAreaIds: ['vitacura', 'las-condes'],
});
assert(
  evaluateOnboardingReadiness(customerSite).readyForVerification,
  'Customer-site business should be able to register without GPS or a precise anchor.',
);
assert(!customerSite.anchorLocation, 'Customer-site registration should not invent a precise location.');

const online = setBusinessPresence(preparedDraft('no-gps-online'), {
  presenceModes: ['online'],
});
assert(
  evaluateOnboardingReadiness(online).readyForVerification,
  'Online business should be able to register without GPS, service area or storefront point.',
);
assert(!online.anchorLocation, 'Online registration should not invent a precise location.');

let storefrontRejected = false;
try {
  setBusinessPresence(preparedDraft('no-gps-storefront'), {
    presenceModes: ['storefront'],
  });
} catch (error) {
  storefrontRejected = error instanceof Error && error.message === 'storefront_location_required';
}
assert(
  storefrontRejected,
  'Fixed storefront must still require an explicitly selected real map location.',
);

const manualStorefront = setBusinessPresence(preparedDraft('manual-map-storefront'), {
  presenceModes: ['storefront'],
  anchorLocation: { lat: -33.421, lng: -70.61 },
});
assert(
  evaluateOnboardingReadiness(manualStorefront).readyForVerification,
  'A manually selected map point should satisfy storefront location without GPS.',
);
assert(
  manualStorefront.anchorLocation?.lat === -33.421 &&
    manualStorefront.anchorLocation?.lng === -70.61,
  'Manual storefront should preserve the owner-selected point rather than a device GPS value.',
);

console.log('PASS: Local Business no-GPS onboarding rules');
