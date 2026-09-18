import type { CommunityIdentityResolver } from './communityHttp';
import type { AuthenticatedPaltaIdentity } from './communityBoundary';
import { authBrokerUserId } from '../../src/auth/accountModel.js';
import type { PaltaUserId } from '../../src/auth/accountModel.js';
import {
  CanonicalAccountResolutionError,
  resolveCanonicalAccount,
} from '../../src/auth/canonicalAccount.js';
import type { CanonicalAccountLookup } from '../../src/auth/canonicalAccount.js';

export type VerifiedBearerPrincipal = {
  /** Supabase auth.users.id after server-side token verification. */
  authBrokerUserId: string;
  /** Auditable subject from the verified auth broker session. */
  authSubject: string;
};

export interface BearerSessionVerifier {
  verify(accessToken: string): Promise<VerifiedBearerPrincipal | null>;
}

export interface PaltaIdentityStore extends CanonicalAccountLookup {
  accountIsActive(paltaUserId: PaltaUserId): Promise<boolean>;
}

export interface SupabaseServerAuthBoundary {
  auth: {
    getUser(accessToken: string): Promise<{
      data: { user: { id: string } | null };
      error: unknown | null;
    }>;
  };
}

export interface PaltaAccountSqlBoundary {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
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
 * Adapter around Supabase Auth's server-side getUser(accessToken) verification.
 * Raw JWT payloads and upstream Apple/Google provider subjects are never accepted
 * as Community identity input.
 */
export class SupabaseBearerSessionVerifier implements BearerSessionVerifier {
  constructor(private readonly client: SupabaseServerAuthBoundary) {}

  async verify(accessToken: string): Promise<VerifiedBearerPrincipal | null> {
    const result = await this.client.auth.getUser(accessToken);
    if (result.error || !result.data.user?.id) return null;
    const userId = result.data.user.id.trim();
    if (!UUID_PATTERN.test(userId)) return null;
    return {
      authBrokerUserId: userId,
      authSubject: userId,
    };
  }
}

/** Server-only account lookup against normalized v1 public.palta_account. */
export class SupabasePaltaIdentityStore implements PaltaIdentityStore {
  constructor(private readonly sql: PaltaAccountSqlBoundary) {}

  async accountExists(paltaUserId: PaltaUserId): Promise<boolean> {
    const result = await this.sql.query<{ exists: boolean }>(
      `select exists(
         select 1 from public.palta_account where user_id = $1::uuid
       ) as exists`,
      [paltaUserId],
    );
    return result.rows[0]?.exists === true;
  }

  async accountIsActive(paltaUserId: PaltaUserId): Promise<boolean> {
    const result = await this.sql.query<{ active: boolean }>(
      `select exists(
         select 1 from public.palta_account
          where user_id = $1::uuid and status = 'active'
       ) as active`,
      [paltaUserId],
    );
    return result.rows[0]?.active === true;
  }
}

/**
 * Server-side identity boundary for private Palta APIs.
 *
 * Normalized v1 deliberately uses the verified Supabase auth.users.id as the
 * canonical public.palta_account.user_id. Community therefore does not resolve
 * provider-specific Apple/Google/email subjects a second time. The verified auth
 * broker UUID must exist as an active Palta account before a private domain service
 * receives it.
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
    if (!principal) return null;

    const normalizedBrokerId = principal.authBrokerUserId.trim();
    if (!UUID_PATTERN.test(normalizedBrokerId)) return null;

    try {
      const resolved = await resolveCanonicalAccount({
        authBrokerUserId: authBrokerUserId(normalizedBrokerId),
        accounts: this.identities,
      });
      if (!(await this.identities.accountIsActive(resolved.paltaUserId))) return null;

      return {
        paltaUserId: resolved.paltaUserId,
        authSubject: principal.authSubject.trim() || normalizedBrokerId,
      };
    } catch (error) {
      if (error instanceof CanonicalAccountResolutionError) return null;
      throw error;
    }
  }
}
