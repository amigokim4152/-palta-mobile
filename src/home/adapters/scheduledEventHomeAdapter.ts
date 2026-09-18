import type { HomeApiItem } from '../../api/paltaApiClient.js';
import type { HomeDataMode } from '../homeRuntimeContract.js';
import type { HomeSourceContribution, HomeSourceDomain } from '../homeSourceContract.js';

export type ScheduledHomeEvent = {
  id: string;
  title: string;
  detail?: string;
  scheduledAt: string;
  confirmed: boolean;
  actionRequired?: boolean;
  attentionLeadMinutes?: number;
  actionLabel?: string;
  actionTarget?: string;
  actionKind?: 'internal' | 'external';
};

export function scheduledEventsToHome(input: {
  sourceDomain: HomeSourceDomain;
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  events: readonly ScheduledHomeEvent[];
  maxFutureDays?: number;
}, now = new Date()): HomeSourceContribution {
  const horizonMs = (input.maxFutureDays ?? 60) * 24 * 60 * 60 * 1000;
  const items: HomeApiItem[] = [];

  for (const event of input.events) {
    if (!event.confirmed) continue;
    const scheduledAt = Date.parse(event.scheduledAt);
    if (!Number.isFinite(scheduledAt)) continue;
    const until = scheduledAt - now.getTime();
    if (until < -60 * 60 * 1000 || until > horizonMs) continue;

    const attentionLeadMs = (event.attentionLeadMinutes ?? 120) * 60 * 1000;
    const needsAttentionNow = Boolean(
      event.actionRequired && until <= attentionLeadMs && until >= -60 * 60 * 1000,
    );

    items.push({
      id: `scheduled-${input.sourceDomain}-${event.id}`,
      kind: needsAttentionNow ? 'action' : 'status',
      title: event.title,
      ...(event.detail ? { body: event.detail } : {}),
      source_domain: input.sourceDomain,
      delivery: needsAttentionNow ? 'home_notify' : 'home',
      related_entity_id: event.id,
      scheduled_at: event.scheduledAt,
      ...(event.actionTarget
        ? {
            action_label: event.actionLabel ?? 'Ver detalle',
            action_target: event.actionTarget,
            action_kind: event.actionKind ?? ('internal' as const),
          }
        : {}),
    });
  }

  return {
    source_domain: input.sourceDomain,
    data_mode: input.dataMode,
    observed_at: input.observedAt,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    items: items.sort(
      (a, b) => Date.parse(a.scheduled_at ?? '') - Date.parse(b.scheduled_at ?? ''),
    ),
  };
}
