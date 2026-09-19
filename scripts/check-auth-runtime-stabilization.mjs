import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const layout = read('mobile-overlay/src/app/_layout.tsx');
const provider = read('mobile-overlay/src/providers/AuthRuntimeProvider.tsx');
const gate = read('mobile-overlay/src/features/auth/AuthGate.tsx');
const catalog = read('src/localization/uiCatalog.ts');
const policy = read('src/runtime/appEntryPolicy.ts');
const qaRoute = read('mobile-overlay/src/app/dev/auth.tsx');

assert(layout.includes('resolveAppEntryPolicy({') && layout.includes('developmentBuild: __DEV__') &&
  layout.includes("entryPolicy === 'app'"),
  'Root layout must use the tested entry policy and production build state.');
assert(policy.includes("options.environment === 'production'"),
  'Production must always require AuthGate.');
assert(qaRoute.includes('<AuthGate qaMode>') && layout.includes("router.push('/dev/auth')"),
  'Development Home must offer an explicit Auth QA route using the existing AuthGate.');
assert(provider.includes("error.code === 'oauth_cancelled'") &&
  provider.includes("setState({ status: 'signed_out' })"),
  'Provider cancellation must return to a usable signed-out state.');
for (const key of [
  'auth.checkingSession', 'auth.signInOrSignUp', 'auth.continueApple',
  'auth.continueGoogle', 'auth.email', 'auth.sendEmailLink',
  'auth.emailLinkSent', 'auth.openSameDevice', 'auth.signOut',
  'auth.errorGeneral', 'auth.errorAccount', 'auth.errorConfiguration',
]) {
  assert(gate.includes(`t('${key}')`), `Auth UI must use the localization catalog: ${key}`);
  assert(catalog.split(`'${key}':`).length === 5, `Auth translation must cover all locales: ${key}`);
}
assert(gate.includes("state.code === 'configuration_error'") &&
  gate.includes("state.code === 'account_bootstrap_missing'"),
  'Auth configuration and canonical-account failures must remain distinguishable.');

await import('../dist/tests/app-entry-policy-tests.js');
console.log('PASS: Auth preview boundary, cancellation and localized UI source');
