import {
  composePublicBusinessCapabilities,
  resolveBusinessActions,
} from '../src/business/businessActionPolicy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const freeProfile = composePublicBusinessCapabilities({
  enabledCapabilities: [],
  hasWhatsapp: true,
  hasPhone: true,
});

assert(freeProfile.includes('whatsapp'), 'Free profile should expose available WhatsApp contact.');
assert(freeProfile.includes('call'), 'Free profile should expose available phone contact.');
assert(freeProfile.includes('save'), 'Consumer save belongs to the common profile experience.');
assert(!freeProfile.includes('quote'), 'Quote must not appear merely because a Business exists.');
assert(!freeProfile.includes('reservation'), 'Booking must not appear merely because a Business exists.');

const quoteBusiness = composePublicBusinessCapabilities({
  enabledCapabilities: ['quote'],
  hasWhatsapp: true,
  hasPhone: false,
});
assert(quoteBusiness.includes('quote'), 'Enabled quote capability should project into the profile.');

const unverifiedOfferActions = resolveBusinessActions({
  capabilities: ['coupon', 'whatsapp'],
  verificationStatus: 'unverified',
});
assert(
  unverifiedOfferActions.find((item) => item.capability === 'coupon')?.enabled === false,
  'Owner-controlled coupon action requires verified ownership independently of paid/free state.',
);
assert(
  unverifiedOfferActions.find((item) => item.capability === 'whatsapp')?.enabled === true,
  'Public contact must not be blocked merely because owner verification is incomplete.',
);

console.log('PASS: Local Business free profile and optional module projection');
