import type {
  Confidence,
  DeliveryLevel,
  Domain,
  Freshness,
  HomeAction,
  HomeCandidate,
} from '../core/contracts.js';
import type { CareTrack } from './careMachine.js';
import { projectCareTrack } from './careStageProjection.js';

export interface CareHomePresentation {
  id: string;
  domain: Domain;
  title: string;
  summary?: string;
  sourceRef?: string;
  occurredAt?: string;
  validFrom?: string;
  validUntil?: string;
  relevance?: number;
  urgency?: 0 | 1 | 2 | 3 | 4;
  importance?: 0 | 1 | 2 | 3 | 4;
  confidence?: Confidence;
  freshness?: Freshness;
  deliveryHint?: DeliveryLevel;
  action?: HomeAction;
  clusterKey?: string;
  includeTerminal?: boolean;
}

function defaultImportance(input: {
  blocked: boolean;
  stage: ReturnType<typeof projectCareTrack>['stage'];
}): 0 | 1 | 2 | 3 | 4 {
  if (input.blocked || input.stage === 'follow_up' || input.stage === 'result') return 3;
  return 2;
}

function defaultUrgency(input: {
  blocked: boolean;
  stage: ReturnType<typeof projectCareTrack>['stage'];
}): 0 | 1 | 2 | 3 | 4 {
  // Quiet by default. Domains may explicitly raise urgency when a real deadline,
  // safety condition or time-sensitive operational reason justifies notification.
  if (input.blocked || input.stage === 'follow_up') return 2;
  return 1;
}

export function buildCareHomeCandidate(
  track: CareTrack,
  presentation: CareHomePresentation,
): HomeCandidate | null {
  const projected = projectCareTrack(track);
  if (projected.terminal && !presentation.includeTerminal) return null;

  const actionRequired =
    projected.blocked ||
    projected.stage === 'follow_up' ||
    (projected.stage === 'prepare' && presentation.action !== undefined);
  const kind: HomeCandidate['kind'] = actionRequired ? 'action' : 'status';

  return {
    id: presentation.id,
    domain: presentation.domain,
    kind,
    title: presentation.title,
    ...(presentation.summary !== undefined ? { summary: presentation.summary } : {}),
    subjectRef: `care:${track.id}`,
    ...(presentation.sourceRef !== undefined ? { sourceRef: presentation.sourceRef } : {}),
    ...(presentation.occurredAt !== undefined ? { occurredAt: presentation.occurredAt } : {}),
    ...(presentation.validFrom !== undefined ? { validFrom: presentation.validFrom } : {}),
    ...(presentation.validUntil !== undefined ? { validUntil: presentation.validUntil } : {}),
    urgency: presentation.urgency ?? defaultUrgency(projected),
    importance: presentation.importance ?? defaultImportance(projected),
    relevance: Math.max(0, Math.min(1, presentation.relevance ?? 1)),
    actionRequired,
    waitingState: projected.waiting,
    confidence: presentation.confidence ?? 'confirmed',
    freshness: presentation.freshness ?? 'current',
    dedupeKey: `care:${track.id}`,
    clusterKey: presentation.clusterKey ?? `care:${track.id}`,
    ...(presentation.deliveryHint !== undefined
      ? { deliveryHint: presentation.deliveryHint }
      : {}),
    ...(presentation.action !== undefined ? { action: presentation.action } : {}),
  };
}
