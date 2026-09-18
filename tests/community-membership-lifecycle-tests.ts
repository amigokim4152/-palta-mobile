import {
  canAssignCommunityRole,
  canManageCommunityMemberships,
  membershipStateForJoin,
  transitionCommunityMembership,
} from '../src/community/communityMembershipLifecycle.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(work: () => unknown, message: string, expectedMessage: string): void {
  try {
    work();
  } catch (error) {
    assert(error instanceof Error, `${message}: expected Error`);
    assert(error.message === expectedMessage, `${message}: got ${error.message}`);
    return;
  }
  throw new Error(`${message}: expected throw`);
}

assert(membershipStateForJoin({ joinPolicy: 'open' }) === 'active', 'Open Community spaces should activate immediately.');
assert(membershipStateForJoin({ joinPolicy: 'approval_required' }) === 'pending', 'Private approval spaces must create pending membership.');
assert(membershipStateForJoin({ joinPolicy: 'approval_required', currentState: 'active' }) === 'active', 'Repeated join must preserve active membership.');
assert(membershipStateForJoin({ joinPolicy: 'invite_only', currentState: 'invited' }) === 'active', 'An existing invitation should be accepted through the join action.');
assertThrows(() => membershipStateForJoin({ joinPolicy: 'invite_only' }), 'Invite-only spaces must not accept uninvited self-service joins', 'COMMUNITY_INVITE_REQUIRED');
assertThrows(() => membershipStateForJoin({ joinPolicy: 'approval_required', currentState: 'removed' }), 'Removed members must not silently rejoin', 'COMMUNITY_MEMBERSHIP_BLOCKED');

assert(canManageCommunityMemberships('admin'), 'Admin should manage membership.');
assert(canManageCommunityMemberships('leader'), 'Leader should manage membership.');
assert(!canManageCommunityMemberships('guardian'), 'Guardian should not approve other members by default.');
assert(!canManageCommunityMemberships('staff'), 'Staff should not receive membership administration implicitly.');
assert(canAssignCommunityRole('admin', 'admin'), 'Admin may delegate admin role.');
assert(canAssignCommunityRole('leader', 'guardian'), 'Leader may assign a non-manager relationship role.');
assert(!canAssignCommunityRole('leader', 'admin'), 'Leader must not escalate another member to admin.');
assert(!canAssignCommunityRole('leader', 'leader'), 'Leader must not create additional managers without admin approval.');

const approved = transitionCommunityMembership({
  currentState: 'pending',
  currentRoleKey: 'member',
  actorRoleKey: 'admin',
  decision: 'approve',
  assignedRoleKey: 'guardian',
  nowIso: '2026-09-18T17:10:00-03:00',
});
assert(approved.state === 'active', 'Approved request should become active.');
assert(approved.roleKey === 'guardian', 'Approval should assign the selected role.');
assert(approved.decidedAt === '2026-09-18T17:10:00-03:00', 'Approval should record decision time.');
assert(approved.endedAt === null, 'Active membership should not have endedAt.');

const rejected = transitionCommunityMembership({
  currentState: 'pending',
  currentRoleKey: 'member',
  actorRoleKey: 'leader',
  decision: 'reject',
  nowIso: '2026-09-18T17:11:00-03:00',
});
assert(rejected.state === 'rejected', 'Rejected request should retain an auditable rejected state.');
assert(rejected.endedAt !== null, 'Rejected relationship should be closed immediately.');

const ended = transitionCommunityMembership({
  currentState: 'active',
  currentRoleKey: 'guardian',
  actorRoleKey: 'admin',
  decision: 'end',
  nowIso: '2026-09-18T17:12:00-03:00',
});
assert(ended.state === 'removed', 'Admin-ended active membership should become removed.');
assert(ended.roleKey === 'guardian', 'Ending membership should preserve role for audit history.');

assertThrows(() => transitionCommunityMembership({
  currentState: 'active', currentRoleKey: 'guardian', actorRoleKey: 'admin', decision: 'approve', assignedRoleKey: 'guardian', nowIso: '2026-09-18T17:13:00-03:00',
}), 'Active membership cannot be approved again', 'COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
assertThrows(() => transitionCommunityMembership({
  currentState: 'pending', currentRoleKey: 'member', actorRoleKey: 'guardian', decision: 'approve', assignedRoleKey: 'guardian', nowIso: '2026-09-18T17:14:00-03:00',
}), 'Non-manager must not approve a request', 'COMMUNITY_MEMBERSHIP_MANAGE_FORBIDDEN');
assertThrows(() => transitionCommunityMembership({
  currentState: 'pending', currentRoleKey: 'member', actorRoleKey: 'admin', decision: 'approve', nowIso: '2026-09-18T17:15:00-03:00',
}), 'Approval must assign a role', 'COMMUNITY_MEMBERSHIP_ROLE_REQUIRED');
assertThrows(() => transitionCommunityMembership({
  currentState: 'pending', currentRoleKey: 'member', actorRoleKey: 'leader', decision: 'approve', assignedRoleKey: 'admin', nowIso: '2026-09-18T17:16:00-03:00',
}), 'Leader must not elevate a request to admin', 'COMMUNITY_MEMBERSHIP_ROLE_ASSIGN_FORBIDDEN');

console.log('PASS: community membership lifecycle tests');
