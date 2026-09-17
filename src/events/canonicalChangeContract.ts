import type { PaltaEvent } from './eventBusPort.js';

export type CanonicalResourceChangePayload = Record<string, unknown> & {
  resourceType: string;
  resourceId: string;
  changeType: string;
};

export function buildCanonicalResourceChangeEvent(input: {
  eventId: string;
  sourceCore: string;
  resourceType: string;
  resourceId: string;
  changeType: string;
  occurredAt: string;
  dedupeKey?: string;
}): PaltaEvent<CanonicalResourceChangePayload> {
  return {
    id: input.eventId,
    type: 'canonical.changed',
    occurredAt: input.occurredAt,
    source: input.sourceCore,
    subjectRef: `${input.resourceType}:${input.resourceId}`,
    ...(input.dedupeKey !== undefined ? { dedupeKey: input.dedupeKey } : {}),
    payload: {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      changeType: input.changeType,
    },
  };
}

export function parseCanonicalResourceChangeEvent(
  event: PaltaEvent,
): {
  eventId: string;
  sourceCore: string;
  resourceType: string;
  resourceId: string;
  changeType: string;
  occurredAt: string;
} | null {
  if (event.type !== 'canonical.changed') return null;
  const payload = event.payload ?? {};
  const resourceType = typeof payload.resourceType === 'string'
    ? payload.resourceType.trim()
    : '';
  const resourceId = typeof payload.resourceId === 'string'
    ? payload.resourceId.trim()
    : '';
  const changeType = typeof payload.changeType === 'string'
    ? payload.changeType.trim()
    : '';
  const sourceCore = event.source.trim();
  const eventId = event.id.trim();
  const occurredAt = event.occurredAt.trim();
  if (!resourceType || !resourceId || !changeType || !sourceCore || !eventId || !occurredAt) {
    return null;
  }
  return {
    eventId,
    sourceCore,
    resourceType,
    resourceId,
    changeType,
    occurredAt,
  };
}
