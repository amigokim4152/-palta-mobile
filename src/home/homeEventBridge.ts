import type {
  EventBusPort,
  PaltaEvent,
  PaltaEventType,
} from '../events/eventBusPort.js';

export const HOME_REFRESH_EVENT_TYPES: readonly PaltaEventType[] = [
  'care.updated',
  'notification.candidate',
  'canonical.changed',
  'relevance.recheck',
  'live.transit',
  'live.weather',
  'live.disaster',
  'content.published',
] as const;

export type HomeEventRefreshDecision = {
  refreshHome: boolean;
  refreshNotifications: boolean;
};

/**
 * Event Core is an invalidation signal, not a second Home data source.
 * Canonical/Care/domain adapters still own the resulting Home facts.
 */
export function homeEventRefreshDecision(
  event: PaltaEvent,
): HomeEventRefreshDecision {
  return {
    refreshHome: HOME_REFRESH_EVENT_TYPES.includes(event.type),
    refreshNotifications: event.type === 'notification.candidate',
  };
}

export async function connectHomeEventBridge(input: {
  eventBus: EventBusPort;
  onHomeInvalidated: (event: PaltaEvent) => Promise<void> | void;
  onNotificationsInvalidated?: (event: PaltaEvent) => Promise<void> | void;
}): Promise<() => Promise<void> | void> {
  return input.eventBus.subscribe(HOME_REFRESH_EVENT_TYPES, async (event) => {
    const decision = homeEventRefreshDecision(event);
    if (decision.refreshHome) await input.onHomeInvalidated(event);
    if (decision.refreshNotifications && input.onNotificationsInvalidated) {
      await input.onNotificationsInvalidated(event);
    }
  });
}
