import type {
  AuthPort,
  AuthState,
} from '../../../../src/ports/authPort';

/**
 * Template only.
 * Actual Supabase client is injected; this adapter does not create it.
 * Palta Core never imports @supabase/supabase-js.
 */
export type SupabaseAuthClientLike = {
  auth: {
    getSession(): Promise<{
      data: {
        session:
          | null
          | {
              access_token: string;
              expires_at?: number;
              user: { id: string };
            };
      };
    }>;
    signOut(): Promise<{ error: unknown | null }>;
    onAuthStateChange(
      callback: (
        event: string,
        session:
          | null
          | {
              access_token: string;
              expires_at?: number;
              user: { id: string };
            },
      ) => void,
    ): {
      data: {
        subscription: { unsubscribe(): void };
      };
    };
  };
};

function normalizeSession(
  session:
    | null
    | {
        access_token: string;
        expires_at?: number;
        user: { id: string };
      },
): AuthState {
  if (!session) return { status: 'signed_out' };

  return {
    status: 'signed_in',
    session: {
      userId: session.user.id,
      accessToken: session.access_token,
      ...(typeof session.expires_at === 'number'
        ? { expiresAt: new Date(session.expires_at * 1000).toISOString() }
        : {}),
    },
  };
}

export class SupabaseAuthAdapter implements AuthPort {
  constructor(private readonly client: SupabaseAuthClientLike) {}

  async getState(): Promise<AuthState> {
    const { data } = await this.client.auth.getSession();
    return normalizeSession(data.session);
  }

  async getAccessToken(): Promise<string | null> {
    const state = await this.getState();
    return state.status === 'signed_in'
      ? state.session.accessToken
      : null;
  }

  async signOut(): Promise<void> {
    const result = await this.client.auth.signOut();
    if (result.error) {
      throw new Error('supabase_sign_out_failed');
    }
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange(
      (_event, session) => listener(normalizeSession(session)),
    );
    return () => data.subscription.unsubscribe();
  }
}
