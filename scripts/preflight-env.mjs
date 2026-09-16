const requiredLocal = [
  "EXPO_PUBLIC_PALTA_API_BASE_URL",
];

const optionalUntilConnected = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_MAP_STYLE_URL",
];

const forbiddenPublicPatterns = [
  /SERVICE_ROLE/i,
  /SECRET/i,
  /PRIVATE/i,
  /ACCESS_TOKEN/i,
  /WEBHOOK_SECRET/i,
];

let failures = 0;

for (const key of requiredLocal) {
  if (!process.env[key]) {
    console.error(`FAIL missing required local variable: ${key}`);
    failures++;
  } else {
    console.log(`PASS ${key}`);
  }
}

for (const key of optionalUntilConnected) {
  if (!process.env[key]) {
    console.log(`WAIT ${key} — not a blocker until that provider is connected`);
  } else {
    console.log(`PASS ${key}`);
  }
}

for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith("EXPO_PUBLIC_") || !value) continue;
  if (forbiddenPublicPatterns.some((pattern) => pattern.test(key))) {
    console.error(`FAIL privileged-looking value exposed as public env: ${key}`);
    failures++;
  }
}

if (failures > 0) process.exit(2);
console.log("PASS environment boundary preflight");
