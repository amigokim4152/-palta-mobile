export type BusinessCapability =
  | 'call'
  | 'whatsapp'
  | 'save'
  | 'follow'
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
  'follow',
  'coupon',
  'pricing',
];

/**
 * Build the public action set without turning optional modules into defaults.
 *
 * The free Business Profile remains useful through public contact + save/follow.
 * Quote/reservation/coupon/pricing/etc. appear only when the Business capability
 * projection says they are enabled. Commercial entitlement is checked elsewhere;
 * this function does not decide whether a module is free, paid, trial or fee-based.
 */
export function composePublicBusinessCapabilities(input: {
  enabledCapabilities?: readonly BusinessCapability[];
  hasWhatsapp: boolean;
  hasPhone: boolean;
}): BusinessCapability[] {
  return [
    ...new Set<BusinessCapability>([
      ...(input.enabledCapabilities ?? []),
      ...(input.hasWhatsapp ? (['whatsapp'] as const) : []),
      ...(input.hasPhone ? (['call'] as const) : []),
      'save',
      'follow',
    ]),
  ];
}

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
