export type SecretKind =
  | 'provider_access_token'
  | 'provider_refresh_token'
  | 'service_role_key'
  | 'webhook_secret'
  | 'signing_key'
  | 'database_admin_credential';

const CLIENT_FORBIDDEN = new Set<SecretKind>([
  'provider_access_token',
  'provider_refresh_token',
  'service_role_key',
  'webhook_secret',
  'signing_key',
  'database_admin_credential',
]);

export function mayExistOnClient(secret: SecretKind): boolean {
  return !CLIENT_FORBIDDEN.has(secret);
}
