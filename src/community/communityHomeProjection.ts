import type { HomeCandidate } from '../core/contracts.js';
import type { PaltaEvent } from '../events/eventBusPort.js';
import type { SchoolFlowStage } from './communityExperience.js';

export type CommunitySchoolItemEvent = {
  outboxId: string;
  occurredAt: string;
  spaceId: string;
  spaceName: string;
  item: {
    id: string;
    postId: string;
    stage: SchoolFlowStage;
    title: string;
    detail: string;
    actionRequired: boolean;
    sensitive: boolean;
    dueAt?: string;
    recipientUserId?: string;
  };
  recipient: {
    userId: string;
    membershipActive: boolean;
    relationshipActive: boolean;
    notificationsEnabled: boolean;
  };
};

function dueUrgency(dueAt: string | undefined, now: Date): 0 | 1 | 2 | 3 | 4 {
  if (!dueAt) return 1;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return 1;
  const remainingMs = due.getTime() - now.getTime();
  if (remainingMs <= 0) return 4;
  if (remainingMs <= 48 * 60 * 60 * 1000) return 3;
  if (remainingMs <= 7 * 24 * 60 * 60 * 1000) return 2;
  return 1;
}

function isRecipientAllowed(input: CommunitySchoolItemEvent): boolean {
  if (!input.recipient.membershipActive || !input.recipient.relationshipActive) return false;
  if (!input.item.recipientUserId) return !input.item.sensitive;
  return input.item.recipientUserId === input.recipient.userId;
}

function candidateKind(stage: SchoolFlowStage, actionRequired: boolean): HomeCandidate['kind'] {
  if ((stage === 'supplies' || stage === 'child_notice') && actionRequired) return 'action';
  return 'info';
}

function importance(stage: SchoolFlowStage): 0 | 1 | 2 | 3 | 4 {
  switch (stage) {
    case 'child_notice': return 4;
    case 'supplies': return 3;
    case 'schedule': return 2;
    case 'announcement': return 2;
  }
}

function stageActionLabel(stage: SchoolFlowStage): string {
  switch (stage) {
    case 'child_notice': return 'Revisar';
    case 'supplies': return 'Ver qué preparar';
    case 'schedule': return 'Ver calendario';
    case 'announcement': return 'Ver aviso';
  }
}

/**
 * Projects an already-authorized, hydrated school item into the shared Home candidate
 * contract. This function intentionally does not resolve membership from IDs: the
 * server-side outbox dispatcher must hydrate the current relationship first so stale
 * or ended school relationships fail closed.
 */
export function projectCommunitySchoolItemToHomeCandidate(
  input: CommunitySchoolItemEvent,
  now = new Date(),
): HomeCandidate | null {
  if (!isRecipientAllowed(input)) return null;

  const kind = candidateKind(input.item.stage, input.item.actionRequired);
  const urgency = kind === 'action' ? dueUrgency(input.item.dueAt, now) : 1;
  const actionRequired = kind === 'action' && input.item.actionRequired;

  return {
    id: `community-school:${input.item.id}:${input.recipient.userId}`,
    domain: 'school',
    kind,
    title: input.item.title,
    summary: input.item.detail,
    subjectRef: input.spaceId,
    sourceRef: input.item.postId,
    occurredAt: input.occurredAt,
    ...(input.item.dueAt ? { validUntil: input.item.dueAt } : {}),
    urgency,
    importance: importance(input.item.stage),
    relevance: input.item.recipientUserId ? 1 : 0.9,
    actionRequired,
    waitingState: false,
    confidence: 'confirmed',
    freshness: 'current',
    dedupeKey: `community-school:${input.spaceId}:${input.item.id}:${input.recipient.userId}`,
    clusterKey: `community-school:${input.spaceId}`,
    // Announcements and schedules remain Home-only. Action items may become
    // home_notify through the shared delivery policy when urgency reaches >= 3.
    ...(kind === 'info' ? { deliveryHint: 'home' as const } : {}),
    action: {
      label: stageActionLabel(input.item.stage),
      target: `/community/${encodeURIComponent(input.spaceId)}/post/${encodeURIComponent(input.item.postId)}`,
      kind: 'internal',
    },
  };
}

export function projectCommunitySchoolItemToNotificationEvent(
  input: CommunitySchoolItemEvent,
  now = new Date(),
): PaltaEvent<{ userId: string; candidate: HomeCandidate }> | null {
  const candidate = projectCommunitySchoolItemToHomeCandidate(input, now);
  if (!candidate) return null;

  return {
    id: `community-notification:${input.outboxId}:${input.recipient.userId}`,
    type: 'notification.candidate',
    occurredAt: input.occurredAt,
    source: 'community',
    subjectRef: input.recipient.userId,
    dedupeKey: candidate.dedupeKey,
    payload: {
      userId: input.recipient.userId,
      candidate,
    },
  };
}

export function shouldPublishCommunityNotificationCandidate(
  input: CommunitySchoolItemEvent,
  candidate: HomeCandidate,
): boolean {
  if (!input.recipient.notificationsEnabled) return false;
  // Home persistence and push eligibility remain separate. Informational school
  // content should not create engagement pushes merely because an outbox row exists.
  return candidate.kind === 'action' && candidate.actionRequired && candidate.urgency >= 3;
}
