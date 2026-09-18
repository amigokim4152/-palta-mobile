const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

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
    : {};

const expectedProviders = ['apple', 'google'];
const disabledProviders = expectedProviders.filter(
  (provider) => external[provider] !== true,
);

if (disabledProviders.length > 0) {
  fail(
    `required Supabase Auth provider(s) are not enabled: ${disabledProviders.join(', ')}`,
  );
}

const enabledExpected = expectedProviders.filter(
  (provider) => external[provider] === true,
);
console.log(
  `PASS: Supabase Auth public settings reachable; required providers enabled: ${enabledExpected.join(', ')}`,
);
