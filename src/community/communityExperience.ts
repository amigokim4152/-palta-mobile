import type { CommunityTrustScope } from './trustScopePolicy.js';

export type CommunityExperienceKind =
  | 'school'
  | 'church'
  | 'neighborhood'
  | 'interest'
  | 'activity'
  | 'apartment';

export type SchoolScope = 'school' | 'grade' | 'class' | 'parents';
export type SchoolFlowStage = 'announcement' | 'schedule' | 'supplies' | 'child_notice';
export type CommunityItemStatus = 'pending' | 'acknowledged' | 'done';

export type SchoolStructuredItem = {
  id: string;
  postId: string;
  stage: SchoolFlowStage;
  title: string;
  detail: string;
  status: CommunityItemStatus;
  actionRequired: boolean;
  sensitive: boolean;
  dueLabel?: string;
};

export const SCHOOL_FLOW_ORDER: readonly SchoolFlowStage[] = [
  'announcement',
  'schedule',
  'supplies',
  'child_notice',
] as const;

const SCHOOL_FLOW_RANK = new Map(
  SCHOOL_FLOW_ORDER.map((stage, index) => [stage, index] as const),
);

export function defaultTrustScopeForCommunityKind(kind: CommunityExperienceKind): CommunityTrustScope {
  switch (kind) {
    case 'school':
    case 'church':
    case 'apartment':
    case 'interest':
      return 'member_group';
    case 'neighborhood':
      return 'verified_local';
    case 'activity':
      return 'public_local';
  }
}

export function orderSchoolFlowItems(items: readonly SchoolStructuredItem[]): SchoolStructuredItem[] {
  return [...items].sort((left, right) => {
    const leftRank = SCHOOL_FLOW_RANK.get(left.stage) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = SCHOOL_FLOW_RANK.get(right.stage) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

export function acknowledgeSchoolFlowItem(items: readonly SchoolStructuredItem[], postId: string): SchoolStructuredItem[] {
  return items.map((item) =>
    item.postId === postId && item.status === 'pending'
      ? { ...item, status: 'acknowledged' as const, actionRequired: false }
      : item,
  );
}

export function schoolFlowProgress(items: readonly SchoolStructuredItem[]): {
  total: number;
  completed: number;
  pendingActionCount: number;
} {
  return {
    total: items.length,
    completed: items.filter((item) => item.status === 'acknowledged' || item.status === 'done').length,
    pendingActionCount: items.filter((item) => item.actionRequired && item.status === 'pending').length,
  };
}

export function shouldDeliverCommunityNotification(input: {
  membershipState: 'active' | 'pending' | 'none' | 'invite_required';
  relationshipActive: boolean;
  notificationsEnabled: boolean;
  now: Date;
  effectiveTo?: string;
}): boolean {
  if (input.membershipState !== 'active') return false;
  if (!input.relationshipActive || !input.notificationsEnabled) return false;
  if (!input.effectiveTo) return true;
  const effectiveTo = new Date(input.effectiveTo);
  if (Number.isNaN(effectiveTo.getTime())) return false;
  return effectiveTo.getTime() > input.now.getTime();
}

export function safeCommunityAuthorLabel(input: {
  displayName: string;
  groupRoleLabel?: string;
  scope: CommunityTrustScope;
  viewerIsMember: boolean;
}): string {
  if (input.viewerIsMember && (input.scope === 'member_group' || input.scope === 'private_relation')) {
    return input.displayName;
  }
  return input.groupRoleLabel?.trim() || 'Miembro de la comunidad';
}
