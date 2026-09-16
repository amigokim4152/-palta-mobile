export type AuthSession = {
  userId: string;
  accessToken: string;
  expiresAt?: string;
};

export type AuthState =
  | { status: 'unknown' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: AuthSession };

export interface AuthPort {
  getState(): Promise<AuthState>;
  getAccessToken(): Promise<string | null>;
  signOut(): Promise<void>;
  subscribe(listener: (state: AuthState) => void): () => void;
}
