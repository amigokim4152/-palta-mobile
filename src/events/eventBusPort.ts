export type PaltaEventType =
  | 'care.updated'
  | 'notification.candidate'
  | 'canonical.changed'
  | 'relevance.recheck'
  | 'live.transit'
  | 'live.weather'
  | 'live.disaster'
  | 'content.published'
  | 'message.created'
  | 'message.read_advanced';

export type PaltaEvent<TPayload = Record<string, unknown>> = {
  id: string;
  type: PaltaEventType;
  occurredAt: string;
  source: string;
  subjectRef?: string;
  dedupeKey?: string;
  payload: TPayload;
};

export interface EventBusPort {
  publish(event: PaltaEvent): Promise<void>;
  subscribe(
    types: readonly PaltaEventType[],
    handler: (event: PaltaEvent) => Promise<void> | void,
  ): Promise<() => Promise<void> | void>;
}
