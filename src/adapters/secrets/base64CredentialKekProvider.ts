import type {
  CredentialKek,
  CredentialKekProvider,
} from './envelopePaymentSecretStore.js';

export type CredentialKekSecretSource = () => Promise<string | null>;

function decodeBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error('Credential KEK secret must be valid base64.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Imports a small rotating set of externally-held 256-bit KEKs into Web Crypto
 * as non-extractable AES-GCM keys. The secret source can be a Cloudflare Secrets
 * Store binding, KMS adapter, HSM adapter or another runtime secret source.
 */
export class Base64CredentialKekProvider implements CredentialKekProvider {
  private readonly sources = new Map<string, CredentialKekSecretSource>();
  private readonly cache = new Map<string, CryptoKey>();

  constructor(
    private readonly currentId: string,
    sources: Readonly<Record<string, CredentialKekSecretSource>>,
    private readonly cryptoImpl: Crypto = globalThis.crypto,
  ) {
    if (!currentId.trim()) throw new Error('Current credential KEK ID is required.');
    for (const [id, source] of Object.entries(sources)) {
      if (!id.trim()) throw new Error('Credential KEK ID cannot be empty.');
      this.sources.set(id, source);
    }
    if (!this.sources.has(currentId)) {
      throw new Error('Current credential KEK ID has no configured secret source.');
    }
  }

  async current(): Promise<CredentialKek> {
    const key = await this.load(this.currentId);
    if (!key) throw new Error('Current credential KEK secret is unavailable.');
    return { id: this.currentId, key };
  }

  async byId(id: string): Promise<CredentialKek | null> {
    const key = await this.load(id);
    return key ? { id, key } : null;
  }

  private async load(id: string): Promise<CryptoKey | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const source = this.sources.get(id);
    if (!source) return null;
    const encoded = await source();
    if (!encoded?.trim()) return null;

    const raw = decodeBase64(encoded.trim());
    try {
      if (raw.byteLength !== 32) {
        throw new Error('Credential KEK must decode to exactly 32 bytes for AES-256-GCM.');
      }
      const key = await this.cryptoImpl.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
      this.cache.set(id, key);
      return key;
    } finally {
      raw.fill(0);
    }
  }
}
