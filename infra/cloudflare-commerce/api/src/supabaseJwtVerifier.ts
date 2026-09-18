import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { VerifiedUserIdentity } from '../../../../src/auth/serverIdentity.js';

const JWKS_BY_ISSUER = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

export class PaltaAuthenticationError extends Error {
  readonly code = 'invalid_access_token';

  constructor(message = 'Valid Supabase access token required.') {
    super(message);
    this.name = 'PaltaAuthenticationError';
  }
}

function supabaseIssuer(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('SUPABASE_URL must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('SUPABASE_URL must not contain credentials.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('SUPABASE_URL must be the project origin without a path.');
  }

  return `${url.origin}/auth/v1`;
}

function bearerToken(header: string | null): string {
  if (!header) throw new PaltaAuthenticationError();
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  const token = match?.[1];
  if (!token) throw new PaltaAuthenticationError();
  return token;
}

function jwksForIssuer(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = JWKS_BY_ISSUER.get(issuer);
  if (existing) return existing;

  const jwks = createRemoteJWKSet(
    new URL(`${issuer}/.well-known/jwks.json`),
  );
  JWKS_BY_ISSUER.set(issuer, jwks);
  return jwks;
}

/**
 * Verify a Supabase user access token at the Palta API boundary.
 *
 * JWT claims prove identity only. Business/POS/payment authorization is resolved
 * separately from Palta's canonical business_operational_grant table.
 */
export async function verifySupabaseRequestIdentity(input: {
  authorizationHeader: string | null;
  supabaseUrl: string;
}): Promise<VerifiedUserIdentity> {
  const issuer = supabaseIssuer(input.supabaseUrl);
  const token = bearerToken(input.authorizationHeader);

  try {
    const { payload } = await jwtVerify(token, jwksForIssuer(issuer), {
      issuer,
      audience: 'authenticated',
    });

    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      throw new PaltaAuthenticationError();
    }
    if (payload.role !== 'authenticated') {
      throw new PaltaAuthenticationError();
    }
    if (payload.is_anonymous === true) {
      throw new PaltaAuthenticationError();
    }

    return { userId: payload.sub };
  } catch (error) {
    if (error instanceof PaltaAuthenticationError) throw error;
    throw new PaltaAuthenticationError();
  }
}
