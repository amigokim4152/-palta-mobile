import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'manifest/mobile-runtime-composition.json'), 'utf8'),
);
const tabLayout = fs.readFileSync(
  path.join(root, 'mobile-overlay/src/app/(tabs)/_layout.tsx'),
  'utf8',
);

function fail(message) {
  throw new Error(message);
}

const market = manifest.surfaces.find((surface) => surface.id === 'market');
if (!market) fail('Mercado must be registered as a composed surface.');
if (market.source_branch !== 'integration/market-v1') {
  fail(`Mercado source branch mismatch: ${market.source_branch}`);
}
if (market.integration_mode !== 'live_overlay') {
  fail('Mercado must remain a live_overlay while its UI paths stay isolated.');
}

for (const requiredPath of [
  'mobile-overlay/src/features/market',
  'mobile-overlay/src/app/(tabs)/market.tsx',
  'mobile-overlay/src/app/market',
]) {
  if (!market.owned_paths.includes(requiredPath)) {
    fail(`Mercado missing owned runtime path: ${requiredPath}`);
  }
}

for (const contractPath of [
  'src/market/marketCatalog.ts',
  'src/market/marketVerticalPolicy.ts',
]) {
  if (!market.reviewed_contract_paths?.includes(contractPath)) {
    fail(`Mercado missing reviewed contract path: ${contractPath}`);
  }
  if (!fs.existsSync(path.join(root, contractPath))) {
    fail(`Mercado reviewed contract is missing from composition source: ${contractPath}`);
  }
}

if (!tabLayout.includes('<Tabs.Screen name="market" options={{ title: \'Mercado\' }} />')) {
  fail('Shared tab layout must expose the Mercado primary tab.');
}

console.log('PASS: Mercado is registered as a live primary surface with reviewed market contracts.');
