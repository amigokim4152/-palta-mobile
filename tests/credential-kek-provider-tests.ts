import { Base64CredentialKekProvider } from '../src/adapters/secrets/base64CredentialKekProvider.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

const key1Bytes = new Uint8Array(32);
const key2Bytes = new Uint8Array(32);
key1Bytes.fill(17);
key2Bytes.fill(29);
let v1Reads = 0;
let v2Reads = 0;
const provider = new Base64CredentialKekProvider('kek-v2', {
  'kek-v1': async () => {
    v1Reads += 1;
    return base64(key1Bytes);
  },
  'kek-v2': async () => {
    v2Reads += 1;
    return base64(key2Bytes);
  },
});

const current = await provider.current();
assert(current.id === 'kek-v2', 'Current KEK provider must use configured rotation head.');
assert(current.key.extractable === false, 'Imported credential KEKs must be non-extractable CryptoKeys.');
assert(v2Reads === 1, 'Current external KEK secret should be loaded once.');

const old = await provider.byId('kek-v1');
assert(old?.id === 'kek-v1', 'Old KEK must remain readable during credential rewrap migration window.');
assert(old?.key.extractable === false, 'Old imported KEK must also be non-extractable.');
assert(v1Reads === 1, 'Old KEK secret should be read when required for migration/read compatibility.');

await provider.current();
await provider.byId('kek-v1');
assert(v2Reads === 1 && v1Reads === 1, 'KEKs should be cached as CryptoKeys instead of repeatedly exposing secret strings.');

const missing = await provider.byId('kek-v404');
assert(missing === null, 'Unknown KEK ID must not silently fall back to the current key.');

let wrongLengthRejected = false;
try {
  const invalid = new Base64CredentialKekProvider('bad', {
    bad: async () => base64(new Uint8Array(16)),
  });
  await invalid.current();
} catch {
  wrongLengthRejected = true;
}
assert(wrongLengthRejected, 'Credential KEK must be exactly 256 bits.');

console.log('PASS: external credential KEK provider tests');
