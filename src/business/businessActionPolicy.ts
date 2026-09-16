export type BusinessCapability =
  | 'call'
  | 'whatsapp'
  | 'save'
  | 'quote'
  | 'reservation'
  | 'queue'
  | 'inquiry'
  | 'coupon'
  | 'pricing';

export type BusinessVerificationStatus =
  | 'unverified'
  | 'claimed'
  | 'verified'
  | 'suspended';

export type BusinessAction = {
  capability: BusinessCapability;
  priority: 'primary' | 'secondary' | 'overflow';
  enabled: boolean;
  reason?: string;
};

const ownerControlled = new Set<BusinessCapability>([
  'coupon',
  'pricing',
]);

const actionOrder: BusinessCapability[] = [
  'quote',
  'reservation',
  'queue',
  'inquiry',
  'whatsapp',
  'call',
  'save',
  'coupon',
  'pricing',
];

export function resolveBusinessActions(input: {
  capabilities: readonly BusinessCapability[];
  verificationStatus: BusinessVerificationStatus;
}): BusinessAction[] {
  if (input.verificationStatus === 'suspended') return [];

  const unique = [...new Set(input.capabilities)];

  return unique
    .sort(
      (a, b) =>
        actionOrder.indexOf(a) - actionOrder.indexOf(b),
    )
    .map((capability, index) => {
      const requiresVerifiedOwner = ownerControlled.has(capability);
      const enabled =
        !requiresVerifiedOwner ||
        input.verificationStatus === 'verified';

      return {
        capability,
        priority:
          index === 0
            ? 'primary'
            : index <= 2
              ? 'secondary'
              : 'overflow',
        enabled,
        ...(!enabled
          ? { reason: 'verified_owner_required' }
          : {}),
      };
    });
}
