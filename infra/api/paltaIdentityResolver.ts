import type { CommunityIdentityResolver } from './communityHttp';
import type { AuthenticatedPaltaIdentity } from './communityBoundary';

export type VerifiedBearerPrincipal = {
  provider: 'apple' | 'google' | 'email' | 'phone';
  providerSubject: string;
  authSubject: string;
};

export interface BearerSessionVerifier {
  verify(accessToken: string): Promise<VerifiedBearerPrincipal | null>;
}

export interface PaltaIdentityStore {
  findActivePaltaUserId(input: {
    provider: VerifiedBearerPrincipal['provider'];
    providerSubject: string;
  }): Promise<string | null>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/**
 * Server-side identity boundary for private Palta APIs.
 *
 * Provider tokens/subjects are never treated as canonical Palta IDs. The verified
 * provider principal is resolved through palta_private.identities to a Palta-owned
 * UUID before any private domain service is called.
 */
export class PaltaApiIdentityResolver implements CommunityIdentityResolver {
  constructor(
    private readonly verifier: BearerSessionVerifier,
    private readonly identities: PaltaIdentityStore,
  ) {}

  async resolve(request: Request): Promise<AuthenticatedPaltaIdentity | null> {
    const token = bearerToken(request);
    if (!token) return null;

    const principal = await this.verifier.verify(token);
    if (!principal || !principal.providerSubject.trim()) return null;

    const paltaUserId = await this.identities.findActivePaltaUserId({
      provider: principal.provider,
      providerSubject: principal.providerSubject,
    });
    if (!paltaUserId || !UUID_PATTERN.test(paltaUserId)) return null;

    return {
      paltaUserId,
      authSubject: principal.authSubject,
    };
  }
}
