export type PrincipalKind =
  | 'user'
  | 'business_owner'
  | 'business_staff'
  | 'organization_admin'
  | 'palta_support'
  | 'palta_operator'
  | 'service';

export type ResourceScope =
  | 'self'
  | 'business'
  | 'organization'
  | 'public'
  | 'system';

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'refund'
  | 'settle'
  | 'impersonate';

export type AuthorizationRequest = {
  principalId: string;
  principalKind: PrincipalKind;
  resourceOwnerId?: string;
  resourceScope: ResourceScope;
  action: Action;
  businessId?: string;
  principalBusinessIds?: readonly string[];
  elevatedSupportGrant?: boolean;
};

export type AuthorizationDecision = {
  allow: boolean;
  reason:
    | 'self_access'
    | 'public_read'
    | 'business_membership'
    | 'explicit_support_grant'
    | 'service_scope'
    | 'denied';
};

export function authorize(
  request: AuthorizationRequest,
): AuthorizationDecision {
  if (request.resourceScope === 'public' && request.action === 'read') {
    return { allow: true, reason: 'public_read' };
  }

  if (
    request.resourceScope === 'self' &&
    request.resourceOwnerId === request.principalId &&
    request.action !== 'impersonate'
  ) {
    return { allow: true, reason: 'self_access' };
  }

  if (
    request.resourceScope === 'business' &&
    request.businessId &&
    request.principalBusinessIds?.includes(request.businessId) &&
    (request.principalKind === 'business_owner' ||
      request.principalKind === 'business_staff')
  ) {
    // Fine-grained business role policy remains a separate capability layer.
    return { allow: true, reason: 'business_membership' };
  }

  if (
    request.principalKind === 'palta_support' &&
    request.elevatedSupportGrant === true &&
    request.action === 'read'
  ) {
    return { allow: true, reason: 'explicit_support_grant' };
  }

  if (
    request.principalKind === 'service' &&
    request.resourceScope === 'system' &&
    request.action !== 'impersonate'
  ) {
    return { allow: true, reason: 'service_scope' };
  }

  return { allow: false, reason: 'denied' };
}
