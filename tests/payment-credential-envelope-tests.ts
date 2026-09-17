import {
  EnvelopePaymentSecretStore,
  openPaymentCredentials,
  sealPaymentCredentials,
  type CredentialKek,
  type CredentialKekProvider,
} from '../src/adapters/secrets/envelopePaymentSecretStore.js';
import type {
  PaymentCredentialEnvelope,
  PaymentCredentialIdentity,
} from '../src/payment/paymentCredentialEnvelope.js';
import type {
  PaymentCredentialEnvelopeLookup,
  PaymentCredentialEnvelopeRepository,
  PaymentCredentialEnvelopeWrite,
} from '../src/persistence/paymentCredentialEnvelopeRepository.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function makeKek(id: string): Promise<CredentialKek> {
  return {
    id,
    key: await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
  };
}

class Keks implements CredentialKekProvider {
  readonly values = new Map<string, CredentialKek>();
  currentId = 'kek-v1';
  async current(): Promise<CredentialKek> {
    const key = this.values.get(this.currentId);
    if (!key) throw new Error('current test KEK missing');
    return key;
  }
  async byId(id: string): Promise<CredentialKek | null> {
    return this.values.get(id) ?? null;
  }
}

function identity(businessId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'): PaymentCredentialIdentity {
  return {
    businessId,
    providerConnectionId: '11111111-1111-4111-8111-111111111111',
    providerKey: 'mercadopago_point',
    credentialRef: 'credential://mp/business-a',
  };
}

function sameIdentity(a: PaymentCredentialEnvelopeLookup, b: PaymentCredentialEnvelope): boolean {
  return a.businessId === b.businessId &&
    a.providerConnectionId === b.providerConnectionId &&
    a.providerKey === b.providerKey &&
    a.credentialRef === b.credentialRef;
}

class MemoryEnvelopeRepository implements PaymentCredentialEnvelopeRepository {
  value: PaymentCredentialEnvelope | null = null;
  async findEnvelope(lookup: PaymentCredentialEnvelopeLookup) {
    return this.value && sameIdentity(lookup, this.value) ? this.value : null;
  }
  async saveEnvelope(write: PaymentCredentialEnvelopeWrite) {
    if (write.expectedRevision === null) {
      if (this.value) throw new Error('duplicate envelope in test');
    } else {
      if (!this.value || this.value.revision !== write.expectedRevision) {
        throw new Error('revision conflict in test');
      }
    }
    this.value = write.envelope;
    return write.envelope;
  }
}

const keks = new Keks();
const kek1 = await makeKek('kek-v1');
const kek2 = await makeKek('kek-v2');
keks.values.set(kek1.id, kek1);
keks.values.set(kek2.id, kek2);

// Direct seal/open round trip.
const sealed = await sealPaymentCredentials({
  id: '22222222-2222-4222-8222-222222222222',
  identity: identity(),
  bundle: { access_token: 'ACCESS-TOKEN-A', refresh_token: 'REFRESH-TOKEN-A' },
  kek: kek1,
  revision: 0,
  createdAt: '2026-09-17T18:00:00.000Z',
  updatedAt: '2026-09-17T18:00:00.000Z',
});
const opened = await openPaymentCredentials({ envelope: sealed, kek: kek1 });
assert(opened.access_token === 'ACCESS-TOKEN-A', 'Envelope encryption must round-trip access token.');
assert(opened.refresh_token === 'REFRESH-TOKEN-A', 'Envelope encryption must round-trip refresh token.');
assert(
  !new TextDecoder().decode(sealed.ciphertext).includes('ACCESS-TOKEN-A'),
  'Persisted credential ciphertext must not contain plaintext token.',
);

// AAD binds ciphertext to exact business/provider/connection/reference identity.
let crossBusinessTamperBlocked = false;
try {
  await openPaymentCredentials({
    envelope: {
      ...sealed,
      businessId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
    kek: kek1,
  });
} catch {
  crossBusinessTamperBlocked = true;
}
assert(
  crossBusinessTamperBlocked,
  'Copying an encrypted credential to another business identity must fail authenticated decryption.',
);

let ciphertextTamperBlocked = false;
try {
  const tampered = new Uint8Array(sealed.ciphertext);
  tampered[0] = (tampered[0] ?? 0) ^ 1;
  await openPaymentCredentials({
    envelope: { ...sealed, ciphertext: tampered },
    kek: kek1,
  });
} catch {
  ciphertextTamperBlocked = true;
}
assert(ciphertextTamperBlocked, 'Modified ciphertext must fail AES-GCM authentication.');

// Vault write/read and rotation use fresh DEK/IV and current KEK.
const repository = new MemoryEnvelopeRepository();
const vault = new EnvelopePaymentSecretStore(repository, keks);
const first = await vault.writeBundle({
  id: '33333333-3333-4333-8333-333333333333',
  identity: identity(),
  bundle: { access_token: 'TOKEN-V1', refresh_token: 'REFRESH-V1' },
  expectedRevision: null,
  occurredAt: '2026-09-17T18:01:00.000Z',
});
const firstToken = await vault.readSecret({
  ...identity(),
  key: 'access_token',
});
assert(firstToken === 'TOKEN-V1', 'Vault must return only requested credential value.');

keks.currentId = 'kek-v2';
const second = await vault.writeBundle({
  id: first.id,
  identity: identity(),
  bundle: { access_token: 'TOKEN-V2', refresh_token: 'REFRESH-V2' },
  expectedRevision: first.revision,
  occurredAt: '2026-09-17T18:02:00.000Z',
});
assert(second.revision === 1 && second.kekId === 'kek-v2', 'Credential rotation must advance revision and use current KEK.');
assert(
  second.ciphertext.some((value, index) => value !== first.ciphertext[index]),
  'Credential rotation must produce a fresh encrypted payload.',
);
const secondToken = await vault.readSecret({ ...identity(), key: 'access_token' });
assert(secondToken === 'TOKEN-V2', 'Credential rotation must make new token canonical.');

const wrongBusinessRead = await vault.readSecret({
  ...identity('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  key: 'access_token',
});
assert(wrongBusinessRead === null, 'Wrong-business credential lookup must not locate another tenant envelope.');

let staleRotationBlocked = false;
try {
  await vault.writeBundle({
    id: second.id,
    identity: identity(),
    bundle: { access_token: 'STALE' },
    expectedRevision: 0,
    occurredAt: '2026-09-17T18:03:00.000Z',
  });
} catch {
  staleRotationBlocked = true;
}
assert(staleRotationBlocked, 'Stale credential rotation must fail optimistic concurrency.');

console.log('PASS: envelope-encrypted payment credential vault tests');
