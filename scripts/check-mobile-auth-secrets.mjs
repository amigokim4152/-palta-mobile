import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const roots = ['mobile-overlay', 'apps/mobile'];
const allowedExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.env', '.md',
]);
const forbidden = [
  { label: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9._-]+/i },
  { label: 'Supabase service-role environment variable', pattern: /SUPABASE_SERVICE_ROLE(?:_KEY)?/i },
  { label: 'Supabase JWT secret', pattern: /SUPABASE_JWT_SECRET/i },
  { label: 'service_role credential reference', pattern: /service[_-]?role\s*(?:key|secret|token)/i },
  {
    label: 'hardcoded Supabase project URL in mobile source',
    pattern: /https:\/\/[a-z0-9-]+\.supabase\.co/i,
  },
  {
    label: 'hardcoded Supabase publishable key value in mobile source',
    pattern: /sb_publishable_[A-Za-z0-9._-]{10,}/i,
  },
];

const violations = [];

function scan(path) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === 'node_modules' || entry === '.expo' || entry === 'dist') continue;
      scan(join(path, entry));
    }
    return;
  }
  if (!allowedExtensions.has(extname(path)) && !path.endsWith('.env.example')) return;
  const text = readFileSync(path, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(text)) {
      violations.push(`${relative(process.cwd(), path)}: ${rule.label}`);
    }
  }
}

for (const root of roots) scan(join(process.cwd(), root));

if (violations.length > 0) {
  console.error('FAIL: privileged or environment-bound Supabase credential material found in mobile surface');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('PASS: mobile Auth surface contains no privileged credentials or hardcoded Supabase environment binding');
