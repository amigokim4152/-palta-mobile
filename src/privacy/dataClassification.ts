export type DataClass =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'personal'
  | 'sensitive_personal'
  | 'payment_restricted';

export type DataHandlingRule = {
  atRestEncryptionRequired: boolean;
  transportEncryptionRequired: boolean;
  auditReadAccess: boolean;
  clientCacheAllowed: boolean;
  analyticsAllowed: boolean;
  exportRequiresExplicitAuthorization: boolean;
};

export function handlingRule(dataClass: DataClass): DataHandlingRule {
  switch (dataClass) {
    case 'public':
      return {
        atRestEncryptionRequired: false,
        transportEncryptionRequired: true,
        auditReadAccess: false,
        clientCacheAllowed: true,
        analyticsAllowed: true,
        exportRequiresExplicitAuthorization: false,
      };
    case 'internal':
      return {
        atRestEncryptionRequired: true,
        transportEncryptionRequired: true,
        auditReadAccess: false,
        clientCacheAllowed: true,
        analyticsAllowed: true,
        exportRequiresExplicitAuthorization: true,
      };
    case 'confidential':
      return {
        atRestEncryptionRequired: true,
        transportEncryptionRequired: true,
        auditReadAccess: true,
        clientCacheAllowed: false,
        analyticsAllowed: false,
        exportRequiresExplicitAuthorization: true,
      };
    case 'personal':
      return {
        atRestEncryptionRequired: true,
        transportEncryptionRequired: true,
        auditReadAccess: true,
        clientCacheAllowed: true,
        analyticsAllowed: true,
        exportRequiresExplicitAuthorization: true,
      };
    case 'sensitive_personal':
    case 'payment_restricted':
      return {
        atRestEncryptionRequired: true,
        transportEncryptionRequired: true,
        auditReadAccess: true,
        clientCacheAllowed: false,
        analyticsAllowed: false,
        exportRequiresExplicitAuthorization: true,
      };
  }
}
