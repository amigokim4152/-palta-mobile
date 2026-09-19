import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const layout = read('mobile-overlay/src/app/_layout.tsx');
const provider = read('mobile-overlay/src/providers/AuthRuntimeProvider.tsx');
const gate = read('mobile-overlay/src/features/auth/AuthGate.tsx');
const catalog = read('src/localization/uiCatalog.ts');

assert(layout.includes("process.env.EXPO_PUBLIC_PALTA_PREVIEW === '1' &&") &&
  layout.includes("process.env.EXPO_PUBLIC_ENV !== 'production'"),
  'Production must never bypass AuthGate through the Preview flag.');
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

console.log('PASS: Auth preview boundary, cancellation and localized UI source');
