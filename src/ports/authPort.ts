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

export type EmailSignInResult = {
  status: 'link_sent';
};

export type AuthPortErrorCode =
  | 'configuration_error'
  | 'provider_error'
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

export interface AuthPort {
  getState(): Promise<AuthState>;
  getAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
  subscribe(listener: (state: AuthState) => void): () => void;
}

export interface InteractiveAuthPort extends AuthPort {
  signInWithOAuth(provider: AuthProvider): Promise<AuthState>;
  signInWithEmail(email: string): Promise<EmailSignInResult>;
  handleRedirect(url: string): Promise<AuthState>;
}
