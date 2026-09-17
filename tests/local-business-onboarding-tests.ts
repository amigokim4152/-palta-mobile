import {
  chooseExistingBusiness,
  confirmBusinessServices,
  createBusinessOnboardingDraft,
  describeBusinessServices,
  evaluateOnboardingReadiness,
  markOwnerVerified,
  requestOwnerVerification,
  setBusinessPresence,
  setServiceSuggestions,
  startNewBusiness,
} from '../src/business/businessOnboarding.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let existing = createBusinessOnboardingDraft('draft-existing');
existing = chooseExistingBusiness(existing, {
  businessId: 'biz-123',
  name: 'Servicio Técnico Vitacura',
  location: { lat: -33.3908, lng: -70.5707 },
  addressLabel: 'Vitacura, Santiago',
  alreadyClaimed: false,
});
existing = describeBusinessServices(existing, 'Reparamos computadores y notebooks a domicilio');
existing = setServiceSuggestions(existing, [
  {
    serviceId: 'computer_repair',
    label: 'Reparación de computadores',
    confidence: 'high',
    matchedTerms: ['computadores', 'notebooks'],
  },
  {
    serviceId: 'computer_repair',
    label: 'Duplicado',
    confidence: 'low',
    matchedTerms: ['notebooks'],
  },
]);
assert(existing.serviceSuggestions.length === 1, 'Suggestions must dedupe by canonical service id.');
existing = confirmBusinessServices(existing, ['computer_repair']);
existing = setBusinessPresence(existing, {
  presenceModes: ['customer_site'],
  serviceAreaIds: ['vitacura', 'las-condes'],
});
let readiness = evaluateOnboardingReadiness(existing);
assert(readiness.readyForVerification, 'Minimum profile must be ready for verification.');
assert(!readiness.readyForPublish, 'Owner-controlled changes must not publish before verification.');
existing = requestOwnerVerification(existing);
assert(existing.stage === 'verification' && existing.verificationStatus === 'pending', 'Verification request must enter pending state.');
existing = markOwnerVerified(existing);
readiness = evaluateOnboardingReadiness(existing);
assert(readiness.readyForPublish, 'Verified complete onboarding must be publishable.');

let storefront = createBusinessOnboardingDraft('draft-storefront');
storefront = startNewBusiness(storefront, { businessName: 'Panadería Barrio Norte' });
storefront = describeBusinessServices(storefront, 'Pan amasado, empanadas y pastelería');
storefront = confirmBusinessServices(storefront, ['bakery']);
let storefrontRejected = false;
try {
  storefront = setBusinessPresence(storefront, { presenceModes: ['storefront'] });
} catch (error) {
  storefrontRejected = error instanceof Error && error.message === 'storefront_location_required';
}
assert(storefrontRejected, 'Storefront registration requires a map location.');

let mobile = createBusinessOnboardingDraft('draft-mobile');
mobile = startNewBusiness(mobile, { businessName: 'Gasfiter a domicilio' });
mobile = describeBusinessServices(mobile, 'Gasfitería, filtraciones y reparación de calefont');
mobile = confirmBusinessServices(mobile, ['gasfiteria', 'calefont_repair']);
mobile = setBusinessPresence(mobile, {
  presenceModes: ['customer_site'],
  serviceAreaIds: ['providencia', 'nunoa'],
});
readiness = evaluateOnboardingReadiness(mobile);
assert(readiness.readyForVerification, 'Customer-site provider must work without a fake storefront pin.');

let claimedRejected = false;
try {
  chooseExistingBusiness(createBusinessOnboardingDraft('draft-claimed'), {
    businessId: 'biz-owned',
    name: 'Already managed',
    alreadyClaimed: true,
  });
} catch (error) {
  claimedRejected = error instanceof Error && error.message === 'business_already_claimed';
}
assert(claimedRejected, 'Already-claimed businesses must not be silently reassigned.');

console.log('PASS: local business onboarding tests');
