export type CredentialKek = {
  id: string;
  key: CryptoKey;
};

/**
 * Small-number key-encryption-key boundary. Runtime implementations may load
 * KEKs from Cloudflare Secrets Store, KMS, HSM or another protected backend.
 * Individual merchant/provider credentials remain encrypted in Postgres.
 */
export interface CredentialKekProvider {
  current(): Promise<CredentialKek>;
  byId(id: string): Promise<CredentialKek | null>;
}

export type CredentialBundle = Record<string, string>;

export type SealedCredentialPayload = {
  ciphertext: Uint8Array;
  dataIv: Uint8Array;
  wrappedDataKey: Uint8Array;
  wrapIv: Uint8Array;
};

function randomIv(cryptoImpl: Crypto): Uint8Array {
  const iv = new Uint8Array(12);
  cryptoImpl.getRandomValues(iv);
  return iv;
}

export function assertCredentialBundle(bundle: CredentialBundle): void {
  const entries = Object.entries(bundle);
  if (entries.length === 0) throw new Error('Credential bundle cannot be empty.');
  for (const [key, value] of entries) {
    if (!key.trim() || !value.trim()) {
      throw new Error('Credential bundle keys and values must be non-empty strings.');
    }
  }
}

async function aesGcmEncrypt(input: {
  cryptoImpl: Crypto;
  key: CryptoKey;
  iv: Uint8Array;
  aad: Uint8Array;
  plaintext: Uint8Array;
}): Promise<Uint8Array> {
  const encrypted = await input.cryptoImpl.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: input.iv,
      additionalData: input.aad,
      tagLength: 128,
    },
    input.key,
    input.plaintext,
  );
  return new Uint8Array(encrypted);
}

async function aesGcmDecrypt(input: {
  cryptoImpl: Crypto;
  key: CryptoKey;
  iv: Uint8Array;
  aad: Uint8Array;
  ciphertext: Uint8Array;
}): Promise<Uint8Array> {
  const decrypted = await input.cryptoImpl.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: input.iv,
      additionalData: input.aad,
      tagLength: 128,
    },
    input.key,
    input.ciphertext,
  );
  return new Uint8Array(decrypted);
}

function parseBundle(bytes: Uint8Array): CredentialBundle {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Decrypted credential bundle is malformed.');
  }
  const result: CredentialBundle = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      throw new Error(`Decrypted credential ${key} is not a string.`);
    }
    result[key] = value;
  }
  assertCredentialBundle(result);
  return result;
}

export async function sealCredentialBundle(input: {
  bundle: CredentialBundle;
  kek: CredentialKek;
  dataAad: Uint8Array;
  wrapAad: Uint8Array;
  cryptoImpl?: Crypto;
}): Promise<SealedCredentialPayload> {
  assertCredentialBundle(input.bundle);
  const cryptoImpl = input.cryptoImpl ?? globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('Web Crypto is required for credential encryption.');

  const dataKey = await cryptoImpl.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const rawDataKey = new Uint8Array(await cryptoImpl.subtle.exportKey('raw', dataKey));
  const dataIv = randomIv(cryptoImpl);
  const wrapIv = randomIv(cryptoImpl);

  try {
    const ciphertext = await aesGcmEncrypt({
      cryptoImpl,
      key: dataKey,
      iv: dataIv,
      aad: input.dataAad,
      plaintext: new TextEncoder().encode(JSON.stringify(input.bundle)),
    });
    const wrappedDataKey = await aesGcmEncrypt({
      cryptoImpl,
      key: input.kek.key,
      iv: wrapIv,
      aad: input.wrapAad,
      plaintext: rawDataKey,
    });
    return { ciphertext, dataIv, wrappedDataKey, wrapIv };
  } finally {
    rawDataKey.fill(0);
  }
}

export async function openCredentialBundle(input: {
  ciphertext: Uint8Array;
  dataIv: Uint8Array;
  wrappedDataKey: Uint8Array;
  wrapIv: Uint8Array;
  kek: CredentialKek;
  dataAad: Uint8Array;
  wrapAad: Uint8Array;
  cryptoImpl?: Crypto;
}): Promise<CredentialBundle> {
  const cryptoImpl = input.cryptoImpl ?? globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('Web Crypto is required for credential decryption.');

  const rawDataKey = await aesGcmDecrypt({
    cryptoImpl,
    key: input.kek.key,
    iv: input.wrapIv,
    aad: input.wrapAad,
    ciphertext: input.wrappedDataKey,
  });
  try {
    const dataKey = await cryptoImpl.subtle.importKey(
      'raw',
      rawDataKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plaintext = await aesGcmDecrypt({
      cryptoImpl,
      key: dataKey,
      iv: input.dataIv,
      aad: input.dataAad,
      ciphertext: input.ciphertext,
    });
    try {
      return parseBundle(plaintext);
    } finally {
      plaintext.fill(0);
    }
  } finally {
    rawDataKey.fill(0);
  }
}
