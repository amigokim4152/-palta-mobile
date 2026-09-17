import fs from 'node:fs';
import path from 'node:path';

const roots = [
  'src/core',
  'src/auth',
  'src/access',
  'src/home',
  'src/care',
  'src/location',
  'src/notifications',
  'src/ports',
  'src/persistence',
  'src/mobile',
  'src/map',
  'src/api',
  'src/verticalSlice',
  'src/commerce',
  'src/payment',
  'src/fiscal',
];

const forbiddenImports = [
  '@supabase/',
  'supabase-js',
  'cloudflare:',
  '@cloudflare/',
  'expo-',
  'expo/',
  '@maplibre/',
  'onesignal',
  '@onesignal/',
  'firebase/',
  '@react-native-firebase/',
];

const forbiddenProviderGlobals = [
  'service_role',
  'sb_secret_',
];

function collect(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) return [full];
    return [];
  });
}

let failed = false;

for (const root of roots) {
  for (const file of collect(root)) {
    const text = fs.readFileSync(file, 'utf8');

    for (const token of forbiddenImports) {
      const importPattern = new RegExp(
        `(?:from\\s+['"][^'"]*${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|import\\s*\\([^)]*${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'i',
      );
      if (importPattern.test(text)) {
        failed = true;
        console.error(`FORBIDDEN provider import in ${file}: ${token}`);
      }
    }

    for (const token of forbiddenProviderGlobals) {
      if (text.toLowerCase().includes(token.toLowerCase())) {
        failed = true;
        console.error(`FORBIDDEN provider secret/global in ${file}: ${token}`);
      }
    }
  }
}

if (failed) process.exit(1);
console.log('PASS: Palta core provider-independence scan');
