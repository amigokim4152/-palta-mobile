import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const market = read('mobile-overlay/src/providers/MarketRuntimeBootstrap.tsx');
const watcher = read('mobile-overlay/src/components/dev/PreviewBuildWatcher.web.tsx');
const auth = read('mobile-overlay/src/features/auth/AuthGate.tsx');
const frame = read('mobile-overlay/src/components/ScreenFrame.tsx');
const communityPolicy = read('mobile-overlay/src/features/community/communityRuntimePolicy.ts');

for (const [name, source] of [['Mercado', market], ['Preview watcher', watcher]]) {
  assert(source.includes("process.env.EXPO_PUBLIC_PALTA_PREVIEW === '1'") &&
    source.includes("process.env.EXPO_PUBLIC_ENV !== 'production'"),
    `${name} preview behavior must be disabled in production.`);
}
assert(communityPolicy.includes("resolvedEnvironment === 'development' || resolvedEnvironment === 'preview'") &&
  communityPolicy.includes("? 'preview'") && communityPolicy.includes(": 'live'"),
  'Community preview fixtures must be limited to development/preview and production must stay live.');
assert(auth.includes('showGate01Evidence && showEvidence') &&
  auth.includes('onPress={() => setShowEvidence((visible) => !visible)}') &&
  !auth.includes('bottom: 20,'),
  'Gate 01 evidence must not cover the tab bar by default.');
assert(frame.includes('paltaTheme.color.canvas') &&
  frame.includes('paltaTheme.color.textPrimary') &&
  frame.includes('allowFontScaling'),
  'Shared screen frame must keep Palta colors and scalable header text.');

console.log('PASS: app shell preview boundary, Gate 01 overlay and shared frame');
