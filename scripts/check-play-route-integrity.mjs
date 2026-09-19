import fs from 'node:fs';

const screen = fs.readFileSync('mobile-overlay/src/features/play/PlayScreen.tsx', 'utf8');
const routes = new Set(fs.readdirSync('mobile-overlay/src/app'));
for (const target of ['map', 'search']) {
  if (routes.has(`${target}.tsx`) || routes.has(target)) continue;
  if (screen.includes(`router.push('/${target}')`)) {
    throw new Error(`Panorama has a button to missing /${target} route.`);
  }
}
if (!screen.includes('onOpenItem={openItem}') || !screen.includes('<DiscoveryDetail')) {
  throw new Error('Panorama cards must still open their detail preview.');
}
console.log('PASS: Panorama has no dead map/search route buttons');
