import type { AuthPort, AuthState } from '../ports/authPort.js';

export class AuthCoordinator {
  constructor(private readonly auth: AuthPort) {}

  async bootstrap(): Promise<AuthState> {
    return this.auth.getState();
  }

  async accessToken(): Promise<string | null> {
    return this.auth.getAccessToken();
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    return this.auth.subscribe(listener);
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
