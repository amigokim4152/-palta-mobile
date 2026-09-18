export type SensitiveAccountAction =
  | 'link_identity'
  | 'unlink_identity'
  | 'change_primary_email'
  | 'export_personal_data'
  | 'request_account_deletion';

export type SessionTerminationReason =
  | 'user_sign_out'
  | 'password_or_credential_change'
  | 'suspected_compromise'
  | 'account_recovery'
  | 'account_deletion';

export type ProviderSignOutScope = 'current_session' | 'all_sessions';

export function signOutScopeForReason(
  reason: SessionTerminationReason,
): ProviderSignOutScope {
  return reason === 'user_sign_out' ? 'current_session' : 'all_sessions';
}

export function requiresFreshAuthentication(
  action: SensitiveAccountAction,
): boolean {
  switch (action) {
    case 'link_identity':
    case 'unlink_identity':
    case 'change_primary_email':
    case 'export_personal_data':
    case 'request_account_deletion':
      return true;
  }
}

export function maximumFreshAuthenticationAgeSeconds(
  action: SensitiveAccountAction,
): number {
  switch (action) {
    case 'link_identity':
    case 'unlink_identity':
    case 'change_primary_email':
      return 10 * 60;
    case 'export_personal_data':
    case 'request_account_deletion':
      return 5 * 60;
  }
}
