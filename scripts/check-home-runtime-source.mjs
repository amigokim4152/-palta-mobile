import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };
const fixtureSource = read('mobile-overlay/src/features/home/demoLegacyLifeCards.ts');
const entrySource = read('mobile-overlay/src/features/home/demoHomeEntries.ts');
const screen = read('mobile-overlay/src/features/home/HomeScreen.tsx');
const route = read('mobile-overlay/src/app/(tabs)/home.tsx');

async function readExports(source) {
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}

const { LEGACY_LIFE_CARD_DEMO_ITEMS } = await readExports(fixtureSource);
const { DEMO_HOME_ENTRIES } = await readExports(entrySource);
const lifeKeys = new Set(LEGACY_LIFE_CARD_DEMO_ITEMS.map((item) => item.capability_key));
const entryKeys = new Set(DEMO_HOME_ENTRIES.map((item) => item.capabilityKey));
for (const key of [
  'glance.precipitation', 'glance.uv', 'today.exchange_rate', 'today.uf',
  'today.food_prices', 'today.fuel_nearby', 'today.traffic_commute',
  'today.daily_brief', 'now.earthquake_alert', 'now.wildfire_alert',
]) assert(lifeKeys.has(key), `Home demo capability disappeared: ${key}`);
for (const key of ['entry.search', 'entry.local_business', 'entry.community', 'entry.marketplace', 'entry.events', 'entry.more']) {
  assert(entryKeys.has(key), `Home entry disappeared: ${key}`);
}
assert(LEGACY_LIFE_CARD_DEMO_ITEMS.length >= 25 && DEMO_HOME_ENTRIES.length >= 19,
  'Home demo inventory must retain the existing life and product coverage.');
assert(DEMO_HOME_ENTRIES.find((entry) => entry.capabilityKey === 'entry.local_business')?.target === '/(tabs)/businesses',
  'Negocios entry must open the actual composed tab.');
assert(DEMO_HOME_ENTRIES.filter((entry) => entry.target).every((entry) =>
  ['/(tabs)/businesses', '/(tabs)/community', '/(tabs)/market', '/(tabs)/play'].includes(entry.target)),
  'Demo entries must not present unimplemented destinations as buttons.');
assert(route.includes("import { HomeScreen }") && route.includes('export default HomeScreen'),
  '/(tabs)/home must render HomeScreen.');
assert(screen.includes('prepareHomeDisplay(state.data, environment, LEGACY_LIFE_CARD_DEMO_ITEMS)') &&
  screen.includes('DEMO_HOME_ENTRIES') && screen.includes('setShowAllDemo'),
  'Home must use explicit demo coverage with compact progressive disclosure.');
assert(screen.includes("adaptive.textScaleClass === 'accessibility'") &&
  screen.includes('stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}') &&
  screen.includes('allowFontScaling'),
  'Home compact rows must adapt to large text.');

console.log('PASS: Home capability inventory, route and adaptive runtime source');
