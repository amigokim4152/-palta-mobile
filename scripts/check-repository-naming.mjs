import fs from 'node:fs';
import path from 'node:path';

const canonical = {
  packageName: 'palta-mobile',
  appName: "name: 'Palta'",
  slug: "slug: 'palta'",
  scheme: "scheme: 'palta'",
  bundleId: "bundleIdentifier: 'cl.somospalta.app'",
  androidId: "package: 'cl.somospalta.app'",
};

const forbiddenTokens = [
  'palta-app-prep',
  'NAREVU',
  'Chile-K',
  'Base44',
];

const runtimeRoots = [
  'src',
  'mobile-overlay/src',
];

const explicitFiles = [
  '.env.example',
  'mobile-overlay/.env.example',
  'mobile-overlay/app.config.v2.7.template.ts',
  'package.json',
];

function collect(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    if (/\.(ts|tsx|js|jsx|mjs|cjs|json|env|txt)$/.test(entry.name)) return [full];
    return [];
  });
}

const files = new Set(explicitFiles.filter((file) => fs.existsSync(file)));
for (const root of runtimeRoots) {
  for (const file of collect(root)) files.add(file);
}

let failed = false;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const token of forbiddenTokens) {
    if (text.toLowerCase().includes(token.toLowerCase())) {
      failed = true;
      console.error(`FORBIDDEN legacy identifier in ${file}: ${token}`);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (packageJson.name !== canonical.packageName) {
  failed = true;
  console.error(`INVALID package name: expected ${canonical.packageName}, got ${packageJson.name}`);
}

const appConfigPath = 'mobile-overlay/app.config.v2.7.template.ts';
if (fs.existsSync(appConfigPath)) {
  const config = fs.readFileSync(appConfigPath, 'utf8');
  for (const [label, expected] of Object.entries(canonical)) {
    if (label === 'packageName') continue;
    if (!config.includes(expected)) {
      failed = true;
      console.error(`INVALID mobile identity in ${appConfigPath}: missing ${expected}`);
    }
  }
}

if (failed) process.exit(1);
console.log('PASS: Palta repository naming and mobile identity scan');
