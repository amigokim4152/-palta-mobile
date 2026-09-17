export type BusinessCustomerRelationshipSnapshot = Readonly<{
  businessId: string;
  userId: string;
  savedAt?: string;
  followedAt?: string;
  regularCustomerSince?: string;
  updatedAt: string;
}>;

export type BusinessRelationshipAction =
  | 'save'
  | 'unsave'
  | 'follow'
  | 'unfollow'
  | 'mark_regular'
  | 'clear_regular';

export type BusinessRelationshipProjection = Readonly<{
  saved: boolean;
  following: boolean;
  regularCustomer: boolean;
}>;

function requireTimestamp(value: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('relationship_timestamp_invalid');
  }
  return value;
}

export function projectBusinessCustomerRelationship(
  relationship: BusinessCustomerRelationshipSnapshot,
): BusinessRelationshipProjection {
  return {
    saved: Boolean(relationship.savedAt),
    following: Boolean(relationship.followedAt),
    regularCustomer: Boolean(relationship.regularCustomerSince),
  };
}

/**
 * Save, follow and regular-customer recognition are deliberately independent.
 * Following does not grant marketing consent and a repeat customer does not
 * silently become a follower.
 */
export function applyBusinessRelationshipAction(input: {
  relationship: BusinessCustomerRelationshipSnapshot;
  action: BusinessRelationshipAction;
  at: string;
}): BusinessCustomerRelationshipSnapshot {
  const at = requireTimestamp(input.at);
  const current = input.relationship;

  switch (input.action) {
    case 'save':
      return { ...current, savedAt: current.savedAt ?? at, updatedAt: at };
    case 'unsave': {
      const { savedAt: _savedAt, ...rest } = current;
      return { ...rest, updatedAt: at };
    }
    case 'follow':
      return { ...current, followedAt: current.followedAt ?? at, updatedAt: at };
    case 'unfollow': {
      const { followedAt: _followedAt, ...rest } = current;
      return { ...rest, updatedAt: at };
    }
    case 'mark_regular':
      return {
        ...current,
        regularCustomerSince: current.regularCustomerSince ?? at,
        updatedAt: at,
      };
    case 'clear_regular': {
      const { regularCustomerSince: _regularCustomerSince, ...rest } = current;
      return { ...rest, updatedAt: at };
    }
  }
}

/**
 * Local Business does not own Notification or Consent truth. Those decisions are
 * supplied by Shared Core. A follow relationship is necessary but never sufficient
 * for follower-update delivery.
 */
export function canReceiveFollowedBusinessUpdate(input: {
  relationship: BusinessCustomerRelationshipSnapshot;
  notificationAllowed: boolean;
  consentAllowedByPolicy: boolean;
}): boolean {
  return Boolean(
    input.relationship.followedAt &&
      input.notificationAllowed &&
      input.consentAllowedByPolicy,
  );
}
