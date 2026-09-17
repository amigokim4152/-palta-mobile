import type { PaltaEvent } from '../events/eventBusPort.js';
import { buildCanonicalResourceChangeEvent } from '../events/canonicalChangeContract.js';
import { buildCareSignalEvent } from '../care/careSignalContract.js';

const SOURCE_CORE = 'service-exchange';
const RESOURCE_TYPE = 'quote_request';

export type QuoteLifecycleEventPair = readonly [PaltaEvent, PaltaEvent];

function resourceRef(quoteRequestId: string): string {
  return `${RESOURCE_TYPE}:${quoteRequestId}`;
}

/**
 * The request is now waiting for one or more provider responses.
 *
 * Service Exchange owns the quote request. Message/Timeline and Care learn
 * about the lifecycle only through these events; neither is called directly.
 */
export function buildQuoteRequestOpenedEvents(input: {
  quoteRequestId: string;
  occurredAt: string;
  sourceSequence?: number;
}): QuoteLifecycleEventPair {
  const canonical = buildCanonicalResourceChangeEvent({
    eventId: `${input.quoteRequestId}:opened`,
    sourceCore: SOURCE_CORE,
    resourceType: RESOURCE_TYPE,
    resourceId: input.quoteRequestId,
    changeType: 'quote_request.opened',
    occurredAt: input.occurredAt,
    dedupeKey: `quote-request:${input.quoteRequestId}:opened`,
  });
  const care = buildCareSignalEvent({
    eventId: `${input.quoteRequestId}:opened:care`,
    sourceCore: SOURCE_CORE,
    resourceType: RESOURCE_TYPE,
    resourceId: input.quoteRequestId,
    careEvent: 'wait',
    occurredAt: input.occurredAt,
    dedupeKey: `quote-request:${input.quoteRequestId}:care:wait`,
    ...(input.sourceSequence !== undefined
      ? { sourceSequence: input.sourceSequence }
      : {}),
    waitingForKey: 'provider_quote_response',
  });
  return [canonical, care];
}

/** Provider responses now exist; Home may surface the result without copying quote values. */
export function buildQuoteResponsesAvailableEvents(input: {
  quoteRequestId: string;
  occurredAt: string;
  sourceSequence?: number;
}): QuoteLifecycleEventPair {
  const canonical = buildCanonicalResourceChangeEvent({
    eventId: `${input.quoteRequestId}:responses-available`,
    sourceCore: SOURCE_CORE,
    resourceType: RESOURCE_TYPE,
    resourceId: input.quoteRequestId,
    changeType: 'quote_request.responses_available',
    occurredAt: input.occurredAt,
    dedupeKey: `quote-request:${input.quoteRequestId}:responses-available`,
  });
  const care = buildCareSignalEvent({
    eventId: `${input.quoteRequestId}:responses-available:care`,
    sourceCore: SOURCE_CORE,
    resourceType: RESOURCE_TYPE,
    resourceId: input.quoteRequestId,
    careEvent: 'result_received',
    occurredAt: input.occurredAt,
    dedupeKey: `quote-request:${input.quoteRequestId}:care:result`,
    ...(input.sourceSequence !== undefined
      ? { sourceSequence: input.sourceSequence }
      : {}),
    resultRef: resourceRef(input.quoteRequestId),
  });
  return [canonical, care];
}

/**
 * A quote was chosen. The quote phase has a result, but the overall service
 * journey still requires the next action (typically booking/visit/work order).
 */
export function buildQuoteSelectedEvents(input: {
  quoteRequestId: string;
  occurredAt: string;
  sourceSequence?: number;
}): QuoteLifecycleEventPair {
  const canonical = buildCanonicalResourceChangeEvent({
    eventId: `${input.quoteRequestId}:selected`,
    sourceCore: SOURCE_CORE,
    resourceType: RESOURCE_TYPE,
    resourceId: input.quoteRequestId,
    changeType: 'quote_request.selected',
    occurredAt: input.occurredAt,
    dedupeKey: `quote-request:${input.quoteRequestId}:selected`,
  });
  const care = buildCareSignalEvent({
    eventId: `${input.quoteRequestId}:selected:care`,
    sourceCore: SOURCE_CORE,
    resourceType: RESOURCE_TYPE,
    resourceId: input.quoteRequestId,
    careEvent: 'require_follow_up',
    occurredAt: input.occurredAt,
    dedupeKey: `quote-request:${input.quoteRequestId}:care:follow-up`,
    ...(input.sourceSequence !== undefined
      ? { sourceSequence: input.sourceSequence }
      : {}),
  });
  return [canonical, care];
}
