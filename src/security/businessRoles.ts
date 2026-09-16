export type BusinessRole =
  | 'owner'
  | 'manager'
  | 'cashier'
  | 'kitchen'
  | 'staff'
  | 'viewer';

export type BusinessCapability =
  | 'business_profile_write'
  | 'catalog_write'
  | 'pricing_write'
  | 'discount_write'
  | 'order_read'
  | 'order_prepare'
  | 'order_complete'
  | 'payment_read'
  | 'refund_create'
  | 'settlement_read'
  | 'staff_manage'
  | 'analytics_read'
  | 'export_data';

const CAPABILITIES: Record<BusinessRole, readonly BusinessCapability[]> = {
  owner: [
    'business_profile_write',
    'catalog_write',
    'pricing_write',
    'discount_write',
    'order_read',
    'order_prepare',
    'order_complete',
    'payment_read',
    'refund_create',
    'settlement_read',
    'staff_manage',
    'analytics_read',
    'export_data',
  ],
  manager: [
    'business_profile_write',
    'catalog_write',
    'pricing_write',
    'discount_write',
    'order_read',
    'order_prepare',
    'order_complete',
    'payment_read',
    'refund_create',
    'analytics_read',
  ],
  cashier: [
    'order_read',
    'order_complete',
    'payment_read',
  ],
  kitchen: [
    'order_read',
    'order_prepare',
  ],
  staff: [
    'order_read',
    'order_prepare',
    'order_complete',
  ],
  viewer: [
    'order_read',
    'analytics_read',
  ],
};

export function roleAllows(
  role: BusinessRole,
  capability: BusinessCapability,
): boolean {
  return CAPABILITIES[role].includes(capability);
}
