const requiredPublic = [
  'EXPO_PUBLIC_PALTA_API_BASE_URL',
  'EXPO_PUBLIC_ENV',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];

const optionalPublic = ['EXPO_PUBLIC_MAP_STYLE_URL'];

const forbiddenPublicPatterns = [
  /SERVICE_ROLE/i,
  /JWT_SECRET/i,
  /PRIVATE/i,
  /ACCESS_TOKEN/i,
  /WEBHOOK_SECRET/i,
];

let failures = 0;

function fail(message) {
  console.error(`FAIL ${message}`);
  failures++;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

for (const key of requiredPublic) {
  if (!process.env[key]?.trim()) fail(`missing required public variable: ${key}`);
  else pass(key);
}

for (const key of optionalPublic) {
  if (!process.env[key]?.trim()) console.log(`WAIT ${key} — optional until its runtime is enabled`);
  else pass(key);
}

const environment = process.env.EXPO_PUBLIC_ENV?.trim();
if (
  environment &&
  !['development', 'preview', 'production'].includes(environment)
) {
  fail('EXPO_PUBLIC_ENV must be development, preview, or production');
}

const goldenEnabled =
  process.env.EXPO_PUBLIC_ENABLE_GOLDEN_USER_AUTH?.trim() === 'true';
const goldenEmail = process.env.EXPO_PUBLIC_GOLDEN_USER_EMAIL?.trim();
const goldenPassword = process.env.EXPO_PUBLIC_GOLDEN_USER_PASSWORD;

if (goldenEnabled) {
  if (environment !== 'development') {
    fail('Golden User Auth may be enabled only when EXPO_PUBLIC_ENV=development');
  }
  if (!goldenEmail) fail('Golden User Auth requires EXPO_PUBLIC_GOLDEN_USER_EMAIL');
  if (!goldenPassword) fail('Golden User Auth requires EXPO_PUBLIC_GOLDEN_USER_PASSWORD');
  if (goldenPassword && goldenPassword.length < 12) {
    fail('Golden User development password must be at least 12 characters');
  }
} else if (environment === 'production' && (goldenEmail || goldenPassword)) {
  fail('Golden User credentials must not be present in production public config');
}

const apiBaseUrl = process.env.EXPO_PUBLIC_PALTA_API_BASE_URL?.trim();
if (apiBaseUrl) {
  try {
    const url = new URL(apiBaseUrl);
    const isLocal =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
    if (url.protocol !== 'https:' && !(environment === 'development' && isLocal)) {
      fail('EXPO_PUBLIC_PALTA_API_BASE_URL must use HTTPS outside local development');
    }
  } catch {
    fail('EXPO_PUBLIC_PALTA_API_BASE_URL must be a valid URL');
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
if (
  supabaseUrl &&
  !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)
) {
  fail('EXPO_PUBLIC_SUPABASE_URL must be an https://<project>.supabase.co URL');
}

const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (publishableKey && !publishableKey.startsWith('sb_publishable_')) {
  fail('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key');
}

for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith('EXPO_PUBLIC_') || !value) continue;
  if (forbiddenPublicPatterns.some((pattern) => pattern.test(key))) {
    fail(`privileged-looking value exposed as public env: ${key}`);
  }
}

if (failures > 0) process.exit(2);
console.log('PASS environment boundary preflight');
