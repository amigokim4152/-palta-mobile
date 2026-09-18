import type { LinkedIdentity } from '../auth/identityModel.js';

export type SignInMethod =
  | 'apple'
  | 'google'
  | 'email_magic_link'
  | 'email_otp'
  | 'phone_otp';

export type SignInRequest = {
  method: SignInMethod;
  returnTo?: string;
  email?: string;
  phone?: string;
};

export type SignInOutcome =
  | { status: 'signed_in' }
  | { status: 'external_flow_started'; authorizationUrl: string }
  | { status: 'code_sent'; destinationHint: string };

export interface IdentityPort {
  beginSignIn(request: SignInRequest): Promise<SignInOutcome>;
  listLinkedIdentities(): Promise<LinkedIdentity[]>;
  linkIdentity(request: SignInRequest): Promise<SignInOutcome>;
  unlinkIdentity(identityId: string): Promise<void>;
}
