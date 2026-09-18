import type {
  HomeApiGlanceItem,
  HomeApiItem,
  HomeApiResponse,
} from '../api/homeApiContract.js';
import type {
  HomeFunctionalItem,
  HomeFunctionalPayload,
  HomeGlanceSignal,
} from './homeFunctionalContract.js';

function apiKind(item: HomeFunctionalItem): HomeApiItem['kind'] {
  return item.kind === 'useful' ? 'useful_today' : item.kind;
}

function projectItem(item: HomeFunctionalItem): HomeApiItem {
  const projected: HomeApiItem = {
    id: item.id,
    ...(item.capabilityKey ? { capability_key: item.capabilityKey } : {}),
    kind: apiKind(item),
    title: item.title,
    source_domain: item.source.domain,
    delivery: 'home',
    surface: item.surface,
    data_mode: item.source.mode,
    ...(item.body ? { body: item.body } : {}),
    ...(item.scheduledAt ? { scheduled_at: item.scheduledAt } : {}),
    ...(item.personalized !== undefined ? { personalized: item.personalized } : {}),
    ...(item.subject ? { subject: item.subject } : {}),
    ...(item.corrections ? { corrections: [...item.corrections] } : {}),
    ...(item.source.observedAt ? { observed_at: item.source.observedAt } : {}),
    ...(item.source.expiresAt ? { expires_at: item.source.expiresAt } : {}),
    ...(item.dedupeKey ? { dedupe_key: item.dedupeKey } : {}),
    ...(item.urgency !== undefined ? { urgency: item.urgency } : {}),
    ...(item.importance !== undefined ? { importance: item.importance } : {}),
    ...(item.relevance !== undefined ? { relevance: item.relevance } : {}),
  };

  if (item.action) {
    projected.action_label = item.action.label;
    projected.action_target = item.action.target;
    projected.action_kind = item.action.kind;
  }

  if (item.action?.kind === 'internal' && item.action.target.startsWith('/care/')) {
    projected.care_track_id = decodeURIComponent(item.action.target.slice('/care/'.length));
  }
  if (item.subject?.id) projected.related_entity_id = item.subject.id;

  return projected;
}

function projectGlance(signal: HomeGlanceSignal): HomeApiGlanceItem {
  const projected: HomeApiGlanceItem = {
    id: signal.id,
    label: signal.label,
    value: signal.value,
    source_domain: signal.source.domain,
    data_mode: signal.source.mode,
    ...(signal.detail ? { detail: signal.detail } : {}),
    ...(signal.exceptional !== undefined ? { exceptional: signal.exceptional } : {}),
    ...(signal.source.observedAt ? { observed_at: signal.source.observedAt } : {}),
    ...(signal.source.expiresAt ? { expires_at: signal.source.expiresAt } : {}),
    ...(signal.relevance !== undefined ? { relevance: signal.relevance } : {}),
  };

  if (signal.action) {
    projected.action_label = signal.action.label;
    projected.action_target = signal.action.target;
    projected.action_kind = signal.action.kind;
  }
  return projected;
}

/**
 * Single HTTP projection for the function-first Home. `items[]` remains flat
 * for backward compatibility; `surface` tells new clients where each item
 * belongs. No second Home endpoint or parallel domain-specific payload exists.
 */
export function projectFunctionalHomeToApi(
  payload: HomeFunctionalPayload,
): HomeApiResponse {
  return {
    contract_version: 'functional-home-v1',
    generated_at: payload.generatedAt,
    locality_label: payload.context.locality.label,
    context: {
      locality: {
        ...(payload.context.locality.id ? { id: payload.context.locality.id } : {}),
        label: payload.context.locality.label,
        change_target: payload.context.locality.changeTarget,
      },
      notifications_target: payload.context.notificationsTarget,
      ...(payload.context.unreadNotificationCount !== undefined
        ? { unread_notification_count: payload.context.unreadNotificationCount }
        : {}),
      profile_target: payload.context.profileTarget,
    },
    glance: payload.glance.map(projectGlance),
    ...(payload.quietState
      ? {
          quiet_state: {
            title: payload.quietState.title,
            ...(payload.quietState.body ? { body: payload.quietState.body } : {}),
          },
        }
      : {}),
    items: [
      ...payload.now,
      ...payload.inProgress,
      ...payload.upcoming,
      ...payload.usefulToday,
    ].map(projectItem),
  };
}
