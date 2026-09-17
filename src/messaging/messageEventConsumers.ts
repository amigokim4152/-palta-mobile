import type { EventBusPort, PaltaEvent } from '../events/eventBusPort.js';
import type { RealtimeAdapter } from './realtimeAdapter.js';

function stringValue(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function integerValue(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export interface MessageEventConsumerSet {
  close(): Promise<void>;
}

export async function startMessageEventConsumers(input: {
  eventBus: EventBusPort;
  realtime: RealtimeAdapter;
}): Promise<MessageEventConsumerSet> {
  const unsubscribeRealtime = await input.eventBus.subscribe(
    ['message.created', 'message.read_advanced', 'message.domain_event_projected'],
    async (event) => {
      const payload = event.payload ?? {};
      const conversationId = stringValue(payload, 'conversationId');
      const sequence = event.type === 'message.read_advanced'
        ? integerValue(payload, 'throughSequence')
        : integerValue(payload, 'sequence');
      if (!conversationId || sequence === undefined) return;

      if (event.type === 'message.created') {
        const messageId = stringValue(payload, 'messageId');
        if (!messageId) return;
        const scopeId = stringValue(payload, 'scopeId');
        await input.realtime.publish({
          conversationId,
          ...(scopeId !== undefined ? { scopeId } : {}),
          sequence,
          kind: 'message_created',
          refId: messageId,
          occurredAt: event.occurredAt,
        });
        return;
      }

      if (event.type === 'message.domain_event_projected') {
        const projectionId = stringValue(payload, 'projectionId');
        const scopeId = stringValue(payload, 'scopeId');
        if (!projectionId || !scopeId) return;
        await input.realtime.publish({
          conversationId,
          scopeId,
          sequence,
          kind: 'domain_event',
          refId: projectionId,
          occurredAt: event.occurredAt,
        });
        return;
      }

      const actorType = stringValue(payload, 'actorType');
      const actorId = stringValue(payload, 'actorId');
      if (!actorType || !actorId) return;
      await input.realtime.publish({
        conversationId,
        sequence,
        kind: 'read_advanced',
        refId: `${actorType}:${actorId}`,
        occurredAt: event.occurredAt,
      });
    },
  );

  const unsubscribeNotificationCandidate = await input.eventBus.subscribe(
    ['message.created'],
    async (event) => {
      const payload = event.payload ?? {};
      const conversationId = stringValue(payload, 'conversationId');
      const messageId = stringValue(payload, 'messageId');
      const sequence = integerValue(payload, 'sequence');
      if (!conversationId || !messageId || sequence === undefined) return;
      const scopeId = stringValue(payload, 'scopeId');

      const candidate: PaltaEvent = {
        id: `${event.id}:notification-candidate`,
        type: 'notification.candidate',
        occurredAt: event.occurredAt,
        source: 'message-core',
        subjectRef: `conversation:${conversationId}`,
        dedupeKey: `message-notification:${messageId}`,
        payload: {
          sourceEventId: event.id,
          sourceType: 'message.created',
          conversationId,
          ...(scopeId !== undefined ? { scopeId } : {}),
          messageId,
          sequence,
        },
      };
      await input.eventBus.publish(candidate);
    },
  );

  return {
    async close() {
      await unsubscribeRealtime();
      await unsubscribeNotificationCandidate();
    },
  };
}
