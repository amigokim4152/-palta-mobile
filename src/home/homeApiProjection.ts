import type { HomeApiItem } from '../api/paltaApiClient.js';
import type { HomeCandidate } from '../core/contracts.js';

const kindMap: Record<HomeApiItem['kind'], HomeCandidate['kind']> = {
  action: 'action',
  status: 'status',
  alert: 'alert',
  useful_today: 'info',
  content: 'content',
};

export function projectHomeApiItem(
  item: HomeApiItem,
  defaults: {
    relevance?: number;
    importance?: 0 | 1 | 2 | 3 | 4;
    urgency?: 0 | 1 | 2 | 3 | 4;
  } = {},
): HomeCandidate {
  return {
    id: item.id,
    domain: item.source_domain === 'news' ? 'news' : 'other',
    kind: kindMap[item.kind],
    title: item.title,
    ...(item.body ? { summary: item.body } : {}),
    ...(item.related_entity_id ? { subjectRef: item.related_entity_id } : {}),
    urgency:
      defaults.urgency ??
      (item.delivery === 'urgent' ? 4 : item.delivery === 'home_notify' ? 2 : 1),
    importance: defaults.importance ?? 2,
    relevance: defaults.relevance ?? 0.7,
    actionRequired: item.kind === 'action' || item.kind === 'alert',
    waitingState: item.kind === 'status',
    confidence: 'confirmed',
    freshness: 'current',
    dedupeKey: item.care_track_id ?? item.related_entity_id ?? item.id,
    deliveryHint: item.delivery,
    ...(item.care_track_id
      ? {
          action: {
            label: 'Ver seguimiento',
            target: `/care/${encodeURIComponent(item.care_track_id)}`,
            kind: 'internal',
          } as const,
        }
      : {}),
  };
}
