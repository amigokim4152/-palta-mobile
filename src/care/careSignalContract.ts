import type { CareEvent } from './careMachine.js';
import type { PaltaEvent } from '../events/eventBusPort.js';

export interface CareSignalPayload extends Record<string, unknown> {
  resourceType: string;
  resourceId: string;
  careEvent: CareEvent;
  sourceSequence?: number;
  expectedAt?: string;
  waitingForKey?: string;
  resultRef?: string;
  outcomeRef?: string;
}

export interface ParsedCareSignal {
  eventId: string;
  sourceCore: string;
  resourceType: string;
  resourceId: string;
  careEvent: CareEvent;
  occurredAt: string;
  sourceSequence?: number;
  expectedAt?: string;
  waitingForKey?: string;
  resultRef?: string;
  outcomeRef?: string;
}

const CARE_EVENTS = new Set<CareEvent>([
  'prepare',
  'start_action',
  'wait',
  'schedule',
  'begin',
  'result_received',
  'complete',
  'require_follow_up',
  'record_outcome',
  'block',
  'resume',
  'cancel',
]);

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function optionalSequence(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

export function buildCareSignalEvent(input: {
  eventId: string;
  sourceCore: string;
  resourceType: string;
  resourceId: string;
  careEvent: CareEvent;
  occurredAt: string;
  dedupeKey?: string;
  sourceSequence?: number;
  expectedAt?: string;
  waitingForKey?: string;
  resultRef?: string;
  outcomeRef?: string;
}): PaltaEvent<CareSignalPayload> {
  const eventId = required(input.eventId, 'eventId');
  const sourceCore = required(input.sourceCore, 'sourceCore');
  const resourceType = required(input.resourceType, 'resourceType');
  const resourceId = required(input.resourceId, 'resourceId');
  const occurredAt = required(input.occurredAt, 'occurredAt');
  if (
    input.sourceSequence !== undefined &&
    (!Number.isInteger(input.sourceSequence) || input.sourceSequence < 0)
  ) {
    throw new Error('sourceSequence must be a non-negative integer.');
  }

  return {
    id: eventId,
    type: 'care.signal',
    occurredAt,
    source: sourceCore,
    subjectRef: `${resourceType}:${resourceId}`,
    ...(input.dedupeKey !== undefined ? { dedupeKey: input.dedupeKey } : {}),
    payload: {
      resourceType,
      resourceId,
      careEvent: input.careEvent,
      ...(input.sourceSequence !== undefined ? { sourceSequence: input.sourceSequence } : {}),
      ...(input.expectedAt !== undefined ? { expectedAt: required(input.expectedAt, 'expectedAt') } : {}),
      ...(input.waitingForKey !== undefined
        ? { waitingForKey: required(input.waitingForKey, 'waitingForKey') }
        : {}),
      ...(input.resultRef !== undefined ? { resultRef: required(input.resultRef, 'resultRef') } : {}),
      ...(input.outcomeRef !== undefined ? { outcomeRef: required(input.outcomeRef, 'outcomeRef') } : {}),
    },
  };
}

export function parseCareSignalEvent(event: PaltaEvent): ParsedCareSignal | null {
  if (event.type !== 'care.signal') return null;

  const payload = event.payload ?? {};
  const resourceType = optionalString(payload.resourceType);
  const resourceId = optionalString(payload.resourceId);
  const careEvent = optionalString(payload.careEvent) as CareEvent | undefined;
  const sourceCore = optionalString(event.source);
  const eventId = optionalString(event.id);
  const occurredAt = optionalString(event.occurredAt);
  const sourceSequence = optionalSequence(payload.sourceSequence);

  if (
    !resourceType ||
    !resourceId ||
    !careEvent ||
    !CARE_EVENTS.has(careEvent) ||
    !sourceCore ||
    !eventId ||
    !occurredAt ||
    sourceSequence === null
  ) {
    return null;
  }

  const expectedAt = optionalString(payload.expectedAt);
  const waitingForKey = optionalString(payload.waitingForKey);
  const resultRef = optionalString(payload.resultRef);
  const outcomeRef = optionalString(payload.outcomeRef);

  return {
    eventId,
    sourceCore,
    resourceType,
    resourceId,
    careEvent,
    occurredAt,
    ...(sourceSequence !== undefined ? { sourceSequence } : {}),
    ...(expectedAt !== undefined ? { expectedAt } : {}),
    ...(waitingForKey !== undefined ? { waitingForKey } : {}),
    ...(resultRef !== undefined ? { resultRef } : {}),
    ...(outcomeRef !== undefined ? { outcomeRef } : {}),
  };
}
