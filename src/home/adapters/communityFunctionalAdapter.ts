import type {
  HomeDataMode,
  HomeFunctionalItem,
} from '../homeFunctionalContract.js';

export type CommunityMembershipHomeSignal = {
  communitySpaceId: string;
  name: string;
  spaceType: string;
  membershipState: 'active' | 'pending';
};

export type CommunityNoticeHomeSignal = {
  communitySpaceId: string;
  postId: string;
  communityName: string;
  spaceType: string;
  body: string;
  createdAt: string;
  announcement: boolean;
  pinned: boolean;
  membershipState: 'active' | 'pending';
};

export type CommunityFunctionalProjection = {
  items: HomeFunctionalItem[];
};

function internalCommunityTarget(spaceId: string): string {
  return `/community/${encodeURIComponent(spaceId)}`;
}

function internalThreadTarget(spaceId: string, postId: string): string {
  return `/community/${encodeURIComponent(spaceId)}/post/${encodeURIComponent(postId)}`;
}

/**
 * Projects only high-signal Community state into Home.
 *
 * This adapter intentionally does not project ordinary posts, comments,
 * reactions, raw unread counts, or public discovery. Those belong on the
 * Community surface. Confirmed school/community schedules continue to use the
 * shared scheduled-event adapter rather than a second scheduling model here.
 */
export function communityToFunctionalHome(
  input: {
    dataMode: HomeDataMode;
    observedAt: string;
    expiresAt?: string;
    memberships: readonly CommunityMembershipHomeSignal[];
    notices: readonly CommunityNoticeHomeSignal[];
    maxNoticeAgeHours?: number;
  },
  now = new Date(),
): CommunityFunctionalProjection {
  if (input.dataMode === 'unavailable') return { items: [] };

  const source = {
    domain: 'community',
    mode: input.dataMode,
    observedAt: input.observedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  } as const;

  const items: HomeFunctionalItem[] = [];

  for (const membership of input.memberships) {
    if (membership.membershipState !== 'pending') continue;
    items.push({
      id: `community-membership-${membership.communitySpaceId}`,
      surface: 'in_progress',
      kind: 'status',
      title: `Solicitud a ${membership.name}`,
      body: 'Tu solicitud de acceso sigue pendiente.',
      personalized: true,
      corrections: ['not_relevant', 'incorrect_information'],
      source,
      action: {
        label: 'Ver comunidad',
        kind: 'internal',
        target: internalCommunityTarget(membership.communitySpaceId),
      },
      dedupeKey: `community-membership:${membership.communitySpaceId}`,
      importance: 2,
      relevance: 0.8,
    });
  }

  const maxNoticeAgeMs = (input.maxNoticeAgeHours ?? 48) * 60 * 60 * 1000;
  for (const notice of input.notices) {
    if (notice.membershipState !== 'active') continue;
    if (!notice.announcement || !notice.pinned) continue;
    if (!notice.body.trim()) continue;

    const createdAt = Date.parse(notice.createdAt);
    if (!Number.isFinite(createdAt)) continue;
    const age = now.getTime() - createdAt;
    if (age < 0 || age > maxNoticeAgeMs) continue;

    items.push({
      id: `community-notice-${notice.postId}`,
      surface: 'useful_today',
      kind: 'useful',
      title: notice.communityName,
      body: notice.body,
      personalized: true,
      corrections: ['not_relevant', 'incorrect_information'],
      source,
      action: {
        label: 'Ver aviso',
        kind: 'internal',
        target: internalThreadTarget(notice.communitySpaceId, notice.postId),
      },
      dedupeKey: `community-post:${notice.postId}`,
      importance: 3,
      relevance: notice.spaceType === 'school' ? 0.9 : 0.8,
    });
  }

  return { items };
}
