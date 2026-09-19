import { mobileRuntime } from '../../services/paltaClient';
import { useCommunityPreview } from './communityRuntimePolicy';
import type {
  CommunityApiMembershipManagement,
  CommunityMembershipDecision,
  CommunityMembershipRoleKey,
} from '../../../../src/api/paltaApiClient';
import {
  canAssignCommunityRole,
  canManageCommunityMemberships,
} from '../../../../src/community/communityMembershipLifecycle';

export type CommunityMembershipManagementData = CommunityApiMembershipManagement;
export type { CommunityMembershipDecision, CommunityMembershipRoleKey };

export interface CommunityMembershipRuntime {
  load(spaceId: string): Promise<CommunityMembershipManagementData>;
  decide(input: {
    spaceId: string;
    membershipId: string;
    action: CommunityMembershipDecision;
    roleKey?: CommunityMembershipRoleKey;
  }): Promise<void>;
}

const previewStore = new Map<string, CommunityMembershipManagementData>();

function previewFor(spaceId: string): CommunityMembershipManagementData {
  const existing = previewStore.get(spaceId);
  if (existing) return existing;

  const data: CommunityMembershipManagementData = spaceId === 'school-1'
    ? {
        currentRoleKey: 'leader',
        pending: [
          { membershipId: 'membership-parent-2', memberLabel: 'Familia de 4º básico', requestedRoleKey: 'guardian', requestedAt: '2026-09-18T15:40:00-03:00' },
          { membershipId: 'membership-staff-1', memberLabel: 'Apoyo del curso', requestedRoleKey: 'staff', requestedAt: '2026-09-18T16:05:00-03:00' },
        ],
        active: [
          { membershipId: 'membership-self', memberLabel: 'Coordinación del curso', roleKey: 'leader', effectiveFrom: '2026-03-01T00:00:00-03:00', isSelf: true },
          { membershipId: 'membership-parent-1', memberLabel: 'Familia del curso', roleKey: 'guardian', effectiveFrom: '2026-03-05T00:00:00-03:00' },
        ],
      }
    : { currentRoleKey: 'member', pending: [], active: [] };

  previewStore.set(spaceId, data);
  return data;
}

function clone(data: CommunityMembershipManagementData): CommunityMembershipManagementData {
  return {
    currentRoleKey: data.currentRoleKey,
    pending: data.pending.map((item) => ({ ...item })),
    active: data.active.map((item) => ({ ...item })),
  };
}


function client() {
  if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
  return mobileRuntime.client;
}

const runtime: CommunityMembershipRuntime = {
  async load(spaceId) {
    if (useCommunityPreview()) return clone(previewFor(spaceId));
    return client().getCommunityMembershipManagement(spaceId);
  },

  async decide(input) {
    if (!useCommunityPreview()) {
      await client().updateCommunityMembership(input);
      return;
    }

    const data = previewFor(input.spaceId);
    if (!canManageCommunityMemberships(data.currentRoleKey)) throw new Error('COMMUNITY_MEMBERSHIP_MANAGE_FORBIDDEN');

    if (input.action === 'approve') {
      if (!input.roleKey) throw new Error('COMMUNITY_MEMBERSHIP_ROLE_REQUIRED');
      if (!canAssignCommunityRole(data.currentRoleKey, input.roleKey)) throw new Error('COMMUNITY_MEMBERSHIP_ROLE_ASSIGN_FORBIDDEN');
      const request = data.pending.find((item) => item.membershipId === input.membershipId);
      if (!request) throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
      data.pending = data.pending.filter((item) => item.membershipId !== input.membershipId);
      data.active.push({
        membershipId: request.membershipId,
        memberLabel: request.memberLabel,
        roleKey: input.roleKey,
        effectiveFrom: new Date().toISOString(),
      });
      return;
    }

    if (input.action === 'reject') {
      const exists = data.pending.some((item) => item.membershipId === input.membershipId);
      if (!exists) throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
      data.pending = data.pending.filter((item) => item.membershipId !== input.membershipId);
      return;
    }

    const member = data.active.find((item) => item.membershipId === input.membershipId);
    if (!member || member.isSelf) throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
    data.active = data.active.filter((item) => item.membershipId !== input.membershipId);
  },
};

export const communityMembershipRuntime = runtime;
