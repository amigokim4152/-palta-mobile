const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const requestedProvider = process.argv[2]?.trim().toLowerCase();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(2);
}

if (!baseUrl || !publishableKey) {
  fail('Supabase public Auth configuration is missing');
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(baseUrl)) {
  fail('EXPO_PUBLIC_SUPABASE_URL is not a hosted Supabase project URL');
}

if (!publishableKey.startsWith('sb_publishable_')) {
  fail('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a publishable key');
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

let response;
try {
  response = await fetch(`${baseUrl}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    signal: controller.signal,
  });
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  fail(`Supabase Auth settings endpoint is unreachable: ${detail}`);
} finally {
  clearTimeout(timeout);
}

if (!response.ok) {
  fail(`Supabase Auth settings endpoint returned HTTP ${response.status}`);
}

let settings;
try {
  settings = await response.json();
} catch {
  fail('Supabase Auth settings response is not valid JSON');
}

const external =
  settings && typeof settings === 'object' && settings.external &&
  typeof settings.external === 'object'
    ? settings.external
    : null;

if (!external) {
  fail('Supabase Auth settings response does not contain external provider settings');
}

if (!requestedProvider) {
  console.log('PASS: Supabase Auth public settings endpoint is reachable and readable');
  process.exit(0);
}

if (!['apple', 'google'].includes(requestedProvider)) {
  fail(`unsupported provider readiness check: ${requestedProvider}`);
}

if (external[requestedProvider] !== true) {
  fail(`required Supabase Auth provider is not enabled: ${requestedProvider}`);
}

console.log(`PASS: Supabase Auth provider enabled: ${requestedProvider}`);
