export type CommunityJoinPolicy = 'open' | 'approval_required' | 'invite_only';

export type CommunityMembershipRecordState =
  | 'invited'
  | 'pending'
  | 'active'
  | 'suspended'
  | 'left'
  | 'removed'
  | 'rejected';

export type CommunityMemberRole =
  | 'member'
  | 'guardian'
  | 'student'
  | 'teacher'
  | 'staff'
  | 'leader'
  | 'admin';

export type CommunityMembershipDecision = 'approve' | 'reject' | 'end';

export type CommunityMembershipTransition = {
  state: CommunityMembershipRecordState;
  roleKey: CommunityMemberRole;
  decidedAt: string | null;
  endedAt: string | null;
};

const MANAGER_ROLES = new Set<CommunityMemberRole>(['leader', 'admin']);
const BLOCKED_REJOIN_STATES = new Set<CommunityMembershipRecordState>([
  'suspended',
  'removed',
]);

export function canManageCommunityMemberships(roleKey: CommunityMemberRole): boolean {
  return MANAGER_ROLES.has(roleKey);
}

export function membershipStateForJoin(input: {
  joinPolicy: CommunityJoinPolicy;
  currentState?: CommunityMembershipRecordState;
}): 'active' | 'pending' {
  if (input.currentState === 'active') return 'active';
  if (input.currentState === 'pending') return 'pending';
  if (input.currentState && BLOCKED_REJOIN_STATES.has(input.currentState)) {
    throw new Error('COMMUNITY_MEMBERSHIP_BLOCKED');
  }
  if (input.joinPolicy === 'invite_only') {
    throw new Error('COMMUNITY_INVITE_REQUIRED');
  }
  return input.joinPolicy === 'open' ? 'active' : 'pending';
}

export function transitionCommunityMembership(input: {
  currentState: CommunityMembershipRecordState;
  currentRoleKey: CommunityMemberRole;
  actorRoleKey: CommunityMemberRole;
  decision: CommunityMembershipDecision;
  assignedRoleKey?: CommunityMemberRole;
  nowIso: string;
}): CommunityMembershipTransition {
  if (!canManageCommunityMemberships(input.actorRoleKey)) {
    throw new Error('COMMUNITY_MEMBERSHIP_MANAGE_FORBIDDEN');
  }

  if (Number.isNaN(new Date(input.nowIso).getTime())) {
    throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TIME');
  }

  if (input.decision === 'approve') {
    if (input.currentState !== 'pending' && input.currentState !== 'invited') {
      throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
    }
    if (!input.assignedRoleKey) {
      throw new Error('COMMUNITY_MEMBERSHIP_ROLE_REQUIRED');
    }
    return {
      state: 'active',
      roleKey: input.assignedRoleKey,
      decidedAt: input.nowIso,
      endedAt: null,
    };
  }

  if (input.decision === 'reject') {
    if (input.currentState !== 'pending' && input.currentState !== 'invited') {
      throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
    }
    return {
      state: 'rejected',
      roleKey: input.currentRoleKey,
      decidedAt: input.nowIso,
      endedAt: input.nowIso,
    };
  }

  if (input.currentState !== 'active' && input.currentState !== 'suspended') {
    throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
  }
  return {
    state: 'removed',
    roleKey: input.currentRoleKey,
    decidedAt: input.nowIso,
    endedAt: input.nowIso,
  };
}
