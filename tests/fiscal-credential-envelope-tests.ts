import {
  EnvelopeFiscalSecretStore,
  openFiscalCredentials,
  sealFiscalCredentials,
} from '../src/adapters/secrets/envelopeFiscalSecretStore.js';
import type {
  CredentialKek,
  CredentialKekProvider,
} from '../src/adapters/secrets/credentialEnvelopeCrypto.js';
import type {
  FiscalCredentialEnvelope,
  FiscalCredentialIdentity,
} from '../src/fiscal/chile/fiscalCredentialEnvelope.js';
import type {
  FiscalCredentialEnvelopeLookup,
  FiscalCredentialEnvelopeRepository,
  FiscalCredentialEnvelopeWrite,
} from '../src/persistence/fiscalCredentialEnvelopeRepository.js';

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
    if (!key) throw new Error('current fiscal test KEK missing');
    return key;
  }
  async byId(id: string): Promise<CredentialKek | null> {
    return this.values.get(id) ?? null;
  }
}

function identity(input: Partial<FiscalCredentialIdentity> = {}): FiscalCredentialIdentity {
  return {
    businessId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    providerConnectionId: '11111111-1111-4111-8111-111111111111',
    providerKey: 'dte_comges',
    issuerRut: '76123456-7',
    credentialRef: 'credential://fiscal/business-a/comges/1',
    ...input,
  };
}

function sameIdentity(a: FiscalCredentialEnvelopeLookup, b: FiscalCredentialEnvelope): boolean {
  return a.businessId === b.businessId &&
    a.providerConnectionId === b.providerConnectionId &&
    a.providerKey === b.providerKey &&
    a.issuerRut === b.issuerRut &&
    a.credentialRef === b.credentialRef;
}

class MemoryRepository implements FiscalCredentialEnvelopeRepository {
  value: FiscalCredentialEnvelope | null = null;
  async findEnvelope(lookup: FiscalCredentialEnvelopeLookup) {
    return this.value && sameIdentity(lookup, this.value) ? this.value : null;
  }
  async saveEnvelope(write: FiscalCredentialEnvelopeWrite) {
    if (write.expectedRevision === null) {
      if (this.value) throw new Error('duplicate fiscal credential envelope');
    } else if (!this.value || this.value.revision !== write.expectedRevision) {
      throw new Error('fiscal credential revision conflict');
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

const sealed = await sealFiscalCredentials({
  id: '22222222-2222-4222-8222-222222222222',
  identity: identity(),
  bundle: { api_key: 'FISCAL-API-KEY-RAW' },
  kek: kek1,
  revision: 0,
  createdAt: '2026-09-17T19:10:00.000Z',
  updatedAt: '2026-09-17T19:10:00.000Z',
});
const opened = await openFiscalCredentials({ envelope: sealed, kek: kek1 });
assert(opened.api_key === 'FISCAL-API-KEY-RAW', 'Fiscal envelope must round-trip provider API key.');
assert(
  !new TextDecoder().decode(sealed.ciphertext).includes('FISCAL-API-KEY-RAW'),
  'Persisted fiscal credential ciphertext must not contain plaintext API key.',
);

let crossRutTamperBlocked = false;
try {
  await openFiscalCredentials({
    envelope: { ...sealed, issuerRut: '76543210-K' },
    kek: kek1,
  });
} catch {
  crossRutTamperBlocked = true;
}
assert(crossRutTamperBlocked, 'Moving fiscal ciphertext to another issuer RUT must fail authenticated decryption.');

let crossBusinessTamperBlocked = false;
try {
  await openFiscalCredentials({
    envelope: { ...sealed, businessId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    kek: kek1,
  });
} catch {
  crossBusinessTamperBlocked = true;
}
assert(crossBusinessTamperBlocked, 'Moving fiscal ciphertext to another business must fail authenticated decryption.');

const repository = new MemoryRepository();
const vault = new EnvelopeFiscalSecretStore(repository, keks);
const first = await vault.writeBundle({
  id: '33333333-3333-4333-8333-333333333333',
  identity: identity(),
  bundle: { api_key: 'FISCAL-KEY-V1' },
  expectedRevision: null,
  occurredAt: '2026-09-17T19:11:00.000Z',
});
const firstKey = await vault.readSecret({ ...identity(), key: 'api_key' });
assert(firstKey === 'FISCAL-KEY-V1', 'Fiscal vault must return only requested secret value.');

keks.currentId = 'kek-v2';
const second = await vault.writeBundle({
  id: first.id,
  identity: identity(),
  bundle: { api_key: 'FISCAL-KEY-V2' },
  expectedRevision: first.revision,
  occurredAt: '2026-09-17T19:12:00.000Z',
});
assert(second.revision === 1 && second.kekId === 'kek-v2', 'Fiscal credential rotation must advance revision and use current KEK.');
assert(
  second.ciphertext.some((value, index) => value !== first.ciphertext[index]),
  'Fiscal credential rotation must produce fresh ciphertext/DEK/IV material.',
);
const secondKey = await vault.readSecret({ ...identity(), key: 'api_key' });
assert(secondKey === 'FISCAL-KEY-V2', 'Fiscal vault must expose rotated canonical API key.');

const wrongRutRead = await vault.readSecret({
  ...identity({ issuerRut: '76543210-K' }),
  key: 'api_key',
});
assert(wrongRutRead === null, 'Wrong-RUT lookup must not locate another issuer credential envelope.');

console.log('PASS: envelope-encrypted fiscal credential vault isolation tests');
