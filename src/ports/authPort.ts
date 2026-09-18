import type {
  AuthBrokerUserId,
  PaltaUserId,
} from '../auth/accountModel.js';
import type { IdentityProvider } from '../auth/identityModel.js';

export type AuthSession = {
  /** Supabase auth.users.id. Never a raw Apple/Google provider subject. */
  authUserId: AuthBrokerUserId;
  /** Canonical Palta account id resolved through Core. */
  paltaUserId: PaltaUserId;
  accessToken: string;
  expiresAt?: string;
};

export type AuthState =
  | { status: 'unknown' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: AuthSession };

export type AuthProvider = Extract<IdentityProvider, 'apple' | 'google'>;

export type AuthCapabilities = {
  apple: boolean;
  google: boolean;
  email: boolean;
};

export type EmailSignInResult = {
  status: 'link_sent';
};

export type AuthPortErrorCode =
  | 'configuration_error'
  | 'provider_error'
  | 'provider_unavailable'
  | 'oauth_cancelled'
  | 'invalid_redirect'
  | 'account_bootstrap_missing'
  | 'account_lookup_failed';

export class AuthPortError extends Error {
  readonly code: AuthPortErrorCode;
  readonly cause?: unknown;

  constructor(code: AuthPortErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AuthPortError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

export type AuthStateListener = (state: AuthState) => void;
export type AuthSubscriptionErrorListener = (error: unknown) => void;

export interface AuthPort {
  getState(): Promise<AuthState>;
  getAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
  /**
   * Auth events and auth-resolution failures are separate channels. A provider
   * session that cannot resolve its canonical Palta account must not be
   * disguised as a normal signed-out event.
   */
  subscribe(
    listener: AuthStateListener,
    onError?: AuthSubscriptionErrorListener,
  ): () => void;
}

export interface InteractiveAuthPort extends AuthPort {
  getCapabilities(): Promise<AuthCapabilities>;
  signInWithOAuth(provider: AuthProvider): Promise<AuthState>;
  signInWithEmail(email: string): Promise<EmailSignInResult>;
  handleRedirect(url: string): Promise<AuthState>;
}
