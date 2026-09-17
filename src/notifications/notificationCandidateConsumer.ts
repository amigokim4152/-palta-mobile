import type { EventBusPort, PaltaEvent } from '../events/eventBusPort.js';
import { toPaltaDeepLink } from '../navigation/deepLink.js';
import type { PaltaNotificationEnvelope } from './notificationEnvelope.js';

export interface MessageNotificationAudiencePort {
  resolveRecipients(input: {
    conversationId: string;
    messageId: string;
  }): Promise<Array<{ recipientUserId: string }>>;
}

export interface NotificationPreferenceDecision {
  decision: 'send_now' | 'defer' | 'suppress';
  notBefore?: string;
}

export interface NotificationPreferencePort {
  decide(input: {
    recipientUserId: string;
    category: 'message';
    occurredAt: string;
  }): Promise<NotificationPreferenceDecision>;
}

export interface MessageNotificationPresentationPort {
  present(input: {
    recipientUserId: string;
    conversationId: string;
    messageId: string;
    occurredAt: string;
  }): Promise<{
    title?: string;
    body?: string;
  }>;
}

export interface NotificationDeliveryQueuePort {
  enqueueIfAbsent(input: {
    dedupeKey: string;
    recipientUserId: string;
    envelope: PaltaNotificationEnvelope;
    notBefore?: string;
  }): Promise<{ enqueued: boolean }>;
}

export interface NotificationCandidateConsumerSet {
  close(): Promise<void>;
}

function stringValue(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function parseMessageCandidate(event: PaltaEvent): {
  conversationId: string;
  messageId: string;
} | null {
  if (event.type !== 'notification.candidate') return null;
  const payload = event.payload ?? {};
  if (stringValue(payload, 'sourceType') !== 'message.created') return null;
  const conversationId = stringValue(payload, 'conversationId');
  const messageId = stringValue(payload, 'messageId');
  if (!conversationId || !messageId) return null;
  return { conversationId, messageId };
}

export async function startNotificationCandidateConsumer(input: {
  eventBus: EventBusPort;
  audience: MessageNotificationAudiencePort;
  preferences: NotificationPreferencePort;
  presentation: MessageNotificationPresentationPort;
  queue: NotificationDeliveryQueuePort;
  maxRecipients?: number;
}): Promise<NotificationCandidateConsumerSet> {
  const maxRecipients = Math.max(1, Math.min(100, input.maxRecipients ?? 20));

  const unsubscribe = await input.eventBus.subscribe(
    ['notification.candidate'],
    async (event) => {
      const candidate = parseMessageCandidate(event);
      if (!candidate) return;

      const recipients = await input.audience.resolveRecipients(candidate);
      if (recipients.length > maxRecipients) {
        throw new Error(
          `Message notification candidate exceeded relationship recipient limit (${maxRecipients}).`,
        );
      }

      const seen = new Set<string>();
      for (const recipient of recipients) {
        const recipientUserId = recipient.recipientUserId.trim();
        if (!recipientUserId || seen.has(recipientUserId)) continue;
        seen.add(recipientUserId);

        const decision = await input.preferences.decide({
          recipientUserId,
          category: 'message',
          occurredAt: event.occurredAt,
        });
        if (decision.decision === 'suppress') continue;

        const presentation = await input.presentation.present({
          recipientUserId,
          conversationId: candidate.conversationId,
          messageId: candidate.messageId,
          occurredAt: event.occurredAt,
        });
        const envelope: PaltaNotificationEnvelope = {
          id: `${event.id}:${recipientUserId}`,
          category: 'message',
          title: presentation.title?.trim() || '새 메시지가 있습니다',
          ...(presentation.body?.trim()
            ? { body: presentation.body.trim() }
            : {}),
          target: toPaltaDeepLink({
            kind: 'context',
            id: candidate.conversationId,
          }),
          occurredAt: event.occurredAt,
          collapseKey: `message:${candidate.conversationId}`,
        };

        await input.queue.enqueueIfAbsent({
          dedupeKey: `message-notification:${candidate.messageId}:${recipientUserId}`,
          recipientUserId,
          envelope,
          ...(decision.decision === 'defer' && decision.notBefore !== undefined
            ? { notBefore: decision.notBefore }
            : {}),
        });
      }
    },
  );

  return {
    async close() {
      await unsubscribe();
    },
  };
}
