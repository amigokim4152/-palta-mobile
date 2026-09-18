import { authBrokerUserId, type PaltaUserId } from '../../../src/auth/accountModel';
import {
  AccountResolutionError,
  resolveCanonicalAccount,
} from '../../../src/auth/accountResolver';
import type {
  AuthProvider,
  AuthState,
  EmailSignInResult,
  InteractiveAuthPort,
} from '../../../src/ports/authPort';
import { AuthPortError } from '../../../src/ports/authPort';

export type ProviderSession =
  | null
  | {
      access_token: string;
      expires_at?: number;
      user: {
        /** Supabase Auth broker user id; not an Apple/Google provider subject. */
        id: string;
        email?: string | null;
      };
    };

// Provider SDK details stay behind this bridge; Core only sees InteractiveAuthPort.
export type SupabaseAuthBridge = {
  getSession(): Promise<ProviderSession>;
  signOut(): Promise<void>;
  subscribe(listener: (session: ProviderSession) => void): () => void;
  accountExists(userId: PaltaUserId): Promise<boolean>;
  signInWithOAuth(provider: AuthProvider): Promise<void>;
  signInWithEmail(email: string): Promise<void>;
  handleRedirect(url: string): Promise<void>;
};

export class SupabaseAuthAdapter implements InteractiveAuthPort {
  constructor(private readonly bridge: SupabaseAuthBridge) {}

  private async resolveSession(session: ProviderSession): Promise<AuthState> {
    if (!session) return { status: 'signed_out' };

    try {
      const resolved = await resolveCanonicalAccount({
        authBrokerUserId: authBrokerUserId(session.user.id),
        accounts: {
          accountExists: (paltaUserId) => this.bridge.accountExists(paltaUserId),
        },
      });

      return {
        status: 'signed_in',
        session: {
          authUserId: resolved.authBrokerUserId,
          paltaUserId: resolved.paltaUserId,
          accessToken: session.access_token,
          ...(typeof session.expires_at === 'number'
            ? { expiresAt: new Date(session.expires_at * 1000).toISOString() }
            : {}),
        },
      };
    } catch (error) {
      if (error instanceof AuthPortError) throw error;
      if (error instanceof AccountResolutionError && error.code === 'account_missing') {
        throw new AuthPortError(
          'account_bootstrap_missing',
          '로그인은 되었지만 Palta 계정 생성이 완료되지 않았습니다. 다시 시도해 주세요.',
          error,
        );
      }
      if (error instanceof Error && error.message === 'auth_broker_user_id_required') {
        throw new AuthPortError(
          'provider_error',
          '인증 사용자 식별자가 올바르지 않습니다.',
          error,
        );
      }
      throw new AuthPortError(
        'account_lookup_failed',
        'Palta 계정을 확인하지 못했습니다. 다시 시도해 주세요.',
        error,
      );
    }
  }

  async getState(): Promise<AuthState> {
    return this.resolveSession(await this.bridge.getSession());
  }

  async getAccessToken(): Promise<string | null> {
    const state = await this.getState();
    return state.status === 'signed_in' ? state.session.accessToken : null;
  }

  async signOut(): Promise<void> {
    await this.bridge.signOut();
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    return this.bridge.subscribe((session) => {
      void this.resolveSession(session)
        .then(listener)
        .catch(() => {
          listener({ status: 'signed_out' });
        });
    });
  }

  async signInWithOAuth(provider: AuthProvider): Promise<AuthState> {
    await this.bridge.signInWithOAuth(provider);
    return this.getState();
  }

  async signInWithEmail(email: string): Promise<EmailSignInResult> {
    await this.bridge.signInWithEmail(email);
    return { status: 'link_sent' };
  }

  async handleRedirect(url: string): Promise<AuthState> {
    await this.bridge.handleRedirect(url);
    return this.getState();
  }
}
