import type { IdentityProvider } from './identityModel.js';

export type ProviderPrincipal = {
  provider: IdentityProvider;
  providerSubject: string;
  authenticatedAt: string;
  emailVerified: boolean;
  verifiedEmail?: string;
};

export function validatedPrincipalEmail(
  principal: ProviderPrincipal,
): string | undefined {
  if (!principal.emailVerified) return undefined;
  const email = principal.verifiedEmail?.trim().toLowerCase();
  return email && email.length > 0 ? email : undefined;
}

export function assertValidProviderPrincipal(
  principal: ProviderPrincipal,
): void {
  if (principal.providerSubject.trim().length === 0) {
    throw new Error('provider_subject_required');
  }
  if (principal.emailVerified && !validatedPrincipalEmail(principal)) {
    throw new Error('verified_email_required_when_email_verified');
  }
}
