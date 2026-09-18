import type {
  AuthPort,
  AuthState,
  AuthSubscriptionErrorListener,
} from '../ports/authPort.js';

export class AuthCoordinator {
  constructor(private readonly auth: AuthPort) {}

  async bootstrap(): Promise<AuthState> {
    return this.auth.getState();
  }

  async accessToken(): Promise<string | null> {
    return this.auth.getAccessToken();
  }

  subscribe(
    listener: (state: AuthState) => void,
    onError?: AuthSubscriptionErrorListener,
  ): () => void {
    return this.auth.subscribe(listener, onError);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
