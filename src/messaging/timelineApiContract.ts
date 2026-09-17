import type {
  ConversationTimelineEntry,
  ConversationTimelinePage,
} from './conversationTimelineService.js';
import { messageToApi, type MessageApiResponse } from './apiContract.js';

export interface DomainTimelineEventApiResponse {
  projection_id: string;
  conversation_id: string;
  scope_id: string;
  sequence: number;
  source_core: string;
  domain_event_id: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  occurred_at: string;
  projected_at: string;
}

export type TimelineApiItem =
  | {
      kind: 'message';
      sequence: number;
      message: MessageApiResponse;
    }
  | {
      kind: 'domain_event';
      sequence: number;
      event: DomainTimelineEventApiResponse;
    };

export interface TimelineListApiResponse {
  items: TimelineApiItem[];
  next_after_sequence: number;
  has_more: boolean;
}

function timelineItemToApi(item: ConversationTimelineEntry): TimelineApiItem {
  if (item.kind === 'message') {
    return {
      kind: 'message',
      sequence: item.sequence,
      message: messageToApi(item.message),
    };
  }

  return {
    kind: 'domain_event',
    sequence: item.sequence,
    event: {
      projection_id: item.event.projectionId,
      conversation_id: item.event.conversationId,
      scope_id: item.event.scopeId ?? '',
      sequence: item.event.sequence,
      source_core: item.event.sourceCore,
      domain_event_id: item.event.eventId,
      event_type: item.event.eventType,
      resource_type: item.event.resourceType,
      resource_id: item.event.resourceId,
      occurred_at: item.event.occurredAt,
      projected_at: item.event.projectedAt,
    },
  };
}

export function timelinePageToApi(
  page: ConversationTimelinePage,
): TimelineListApiResponse {
  return {
    items: page.items.map(timelineItemToApi),
    next_after_sequence: page.nextAfterSequence,
    has_more: page.hasMore,
  };
}
