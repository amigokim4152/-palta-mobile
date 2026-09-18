function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const {
  canUnlinkIdentity,
  providerIdentityKey,
} = await import('../src/auth/identityModel.js');
const {
  authBrokerUserId,
  paltaUserIdFromAuthBrokerUserId,
} = await import('../src/auth/accountModel.js');
const {
  CanonicalAccountResolutionError,
  resolveCanonicalAccount,
} = await import('../src/auth/canonicalAccount.js');
const {
  initialOnboardingPrompts,
  validateProfilePrompt,
} = await import('../src/profile/progressiveProfile.js');
const {
  PROFILE_FACET_BOUNDARIES,
} = await import('../src/profile/profileModel.js');

const appleIdentity = {
  identityId: 'identity-apple',
  paltaUserId: 'palta-user-1',
  provider: 'apple' as const,
  providerSubject: 'apple-subject-1',
  state: 'active' as const,
  linkedAt: '2026-09-17T00:00:00Z',
};

const googleIdentity = {
  identityId: 'identity-google',
  paltaUserId: 'palta-user-1',
  provider: 'google' as const,
  providerSubject: 'google-subject-1',
  state: 'active' as const,
  linkedAt: '2026-09-17T00:00:00Z',
};

assert(
  canUnlinkIdentity([appleIdentity], appleIdentity.identityId) === false,
  'The last active sign-in identity must not be removable.',
);
assert(
  canUnlinkIdentity(
    [appleIdentity, googleIdentity],
    appleIdentity.identityId,
  ) === true,
  'An identity may be removable when another active sign-in identity remains.',
);
assert(
  providerIdentityKey('google', 'subject-123') === 'google:subject-123',
  'Provider identity keys must preserve provider namespace.',
);

const brokerId = authBrokerUserId(' auth-user-001 ');
assert(
  brokerId === 'auth-user-001' && paltaUserIdFromAuthBrokerUserId(brokerId) === 'auth-user-001',
  'Normalized v1 must explicitly map the broker user id to the canonical Palta account id.',
);

const canonical = await resolveCanonicalAccount({
  authBrokerUserId: brokerId,
  accounts: {
    accountExists: async (paltaUserId) => paltaUserId === 'auth-user-001',
  },
});
assert(
  canonical.authBrokerUserId === brokerId && canonical.paltaUserId === 'auth-user-001',
  'Canonical account resolution must return the verified broker/account mapping.',
);

let missingCanonicalRejected = false;
try {
  await resolveCanonicalAccount({
    authBrokerUserId: authBrokerUserId('auth-user-missing'),
    accounts: { accountExists: async () => false },
  });
} catch (error) {
  missingCanonicalRejected =
    error instanceof CanonicalAccountResolutionError && error.code === 'account_missing';
}
assert(
  missingCanonicalRejected,
  'Canonical account resolution must not create a missing Palta account client-side.',
);

const initialPrompts = initialOnboardingPrompts();
assert(
  initialPrompts.length === 2 &&
    initialPrompts.every((prompt) => !prompt.blocking && prompt.canSkip) &&
    initialPrompts.some((prompt) => prompt.field === 'preferred_name') &&
    initialPrompts.some((prompt) => prompt.field === 'home_commune'),
  'Initial onboarding must remain minimal and skippable.',
);

assert(
  validateProfilePrompt({
    field: 'rut',
    purpose: 'tax_identity',
    userBenefit: 'Use a tax-specific action.',
    surface: 'onboarding',
    dataClass: 'sensitive_personal',
    blocking: false,
    canSkip: true,
  }).allowed === false,
  'RUT must not be requested during initial onboarding.',
);

assert(
  validateProfilePrompt({
    field: 'health_detail',
    purpose: 'health_follow_up',
    userBenefit: 'Provide health-specific follow-up.',
    surface: 'onboarding',
    dataClass: 'sensitive_personal',
    blocking: false,
    canSkip: true,
  }).allowed === false,
  'Health detail must not be requested during initial onboarding.',
);

assert(
  validateProfilePrompt({
    field: 'vehicle',
    purpose: 'vehicle_reminders',
    userBenefit: 'Remind the user about vehicle obligations.',
    surface: 'vehicle_setup',
    dataClass: 'personal',
    blocking: false,
    canSkip: true,
  }).allowed === true,
  'Contextual non-sensitive profile prompts should be allowed when purpose and benefit are explicit.',
);

assert(
  PROFILE_FACET_BOUNDARIES.every(
    (boundary) => boundary.embeddedInCoreProfile === false,
  ),
  'Household, roles, organizations, things, health and finance must remain outside Core Profile.',
);

console.log('PASS: Palta auth/profile core regression tests');
