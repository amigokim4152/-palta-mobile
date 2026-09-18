import type {
  HomeAction,
  HomeCorrectionReason,
  HomeDataMode,
  HomeFunctionalItem,
  HomeSubjectRef,
} from '../homeFunctionalContract.js';

export type ScheduledFunctionalEvent = {
  id: string;
  title: string;
  detail?: string;
  scheduledAt: string;
  confirmed: boolean;
  actionRequired?: boolean;
  attentionLeadMinutes?: number;
  action?: HomeAction;
  personalized?: boolean;
  subject?: HomeSubjectRef;
  corrections?: HomeCorrectionReason[];
};

export type ScheduledFunctionalProjectionInput = {
  sourceDomain: string;
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  events: readonly ScheduledFunctionalEvent[];
  maxFutureDays?: number;
};

function defaultCorrections(
  event: ScheduledFunctionalEvent,
): HomeCorrectionReason[] | undefined {
  if (!event.personalized) return event.corrections;
  return event.corrections ?? [
    'not_relevant',
    'wrong_subject',
    'already_done',
    'incorrect_information',
  ];
}

/**
 * Converts confirmed schedules from any domain into the shared Home semantics.
 *
 * A future confirmed event normally belongs to PRÓXIMO. It moves to AHORA only
 * when a real executable action exists and the event has entered its configured
 * attention window. Unconfirmed dates never become Home schedules.
 */
export function scheduledEventsToFunctionalHome(
  input: ScheduledFunctionalProjectionInput,
  now = new Date(),
): HomeFunctionalItem[] {
  const horizonMs = (input.maxFutureDays ?? 60) * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  const items: HomeFunctionalItem[] = [];

  for (const event of input.events) {
    if (!event.confirmed) continue;

    const scheduledAtMs = Date.parse(event.scheduledAt);
    if (!Number.isFinite(scheduledAtMs)) continue;

    const untilMs = scheduledAtMs - nowMs;
    if (untilMs < -60 * 60 * 1000 || untilMs > horizonMs) continue;

    const leadMs = (event.attentionLeadMinutes ?? 120) * 60 * 1000;
    const needsAttentionNow = Boolean(
      event.actionRequired &&
      event.action &&
      untilMs >= -60 * 60 * 1000 &&
      untilMs <= leadMs,
    );

    const item: HomeFunctionalItem = {
      id: `scheduled-${input.sourceDomain}-${event.id}`,
      surface: needsAttentionNow ? 'now' : 'upcoming',
      kind: needsAttentionNow ? 'action' : 'status',
      title: event.title,
      scheduledAt: event.scheduledAt,
      source: {
        domain: input.sourceDomain,
        mode: input.dataMode,
        observedAt: input.observedAt,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      },
      ...(event.detail ? { body: event.detail } : {}),
      ...(event.action ? { action: event.action } : {}),
      ...(event.personalized !== undefined
        ? { personalized: event.personalized }
        : {}),
      ...(event.subject ? { subject: event.subject } : {}),
    };

    const corrections = defaultCorrections(event);
    if (corrections) item.corrections = corrections;
    items.push(item);
  }

  return items.sort((a, b) =>
    Date.parse(a.scheduledAt ?? '') - Date.parse(b.scheduledAt ?? ''),
  );
}
