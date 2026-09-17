import {
  buildQuoteRequestOpenedEvents,
  buildQuoteResponsesAvailableEvents,
  buildQuoteSelectedEvents,
} from '../src/serviceExchange/quoteLifecycleEvents.js';
import { parseCanonicalResourceChangeEvent } from '../src/events/canonicalChangeContract.js';
import { parseCareSignalEvent } from '../src/care/careSignalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const opened = buildQuoteRequestOpenedEvents({
  quoteRequestId: 'quote-request-1',
  occurredAt: '2026-09-17T22:00:00.000Z',
  sourceSequence: 1,
});
const openedCanonical = parseCanonicalResourceChangeEvent(opened[0]);
const openedCare = parseCareSignalEvent(opened[1]);
assert(openedCanonical?.sourceCore === 'service-exchange', 'Quote canonical event must preserve owning core.');
assert(openedCanonical?.resourceType === 'quote_request', 'Quote lifecycle must use stable quote_request resource type.');
assert(openedCanonical?.changeType === 'quote_request.opened', 'Opening request must emit canonical lifecycle change.');
assert(openedCare?.careEvent === 'wait', 'Opening request must put the service Care track into waiting.');
assert(openedCare?.waitingForKey === 'provider_quote_response', 'Waiting reason must be explicit and domain-owned.');
assert(openedCare?.sourceSequence === 1, 'Quote domain sequence must pass through Care signal.');

const available = buildQuoteResponsesAvailableEvents({
  quoteRequestId: 'quote-request-1',
  occurredAt: '2026-09-17T22:15:00.000Z',
  sourceSequence: 2,
});
const availableCanonical = parseCanonicalResourceChangeEvent(available[0]);
const availableCare = parseCareSignalEvent(available[1]);
assert(availableCanonical?.changeType === 'quote_request.responses_available', 'Response availability must be a canonical lifecycle change.');
assert(availableCare?.careEvent === 'result_received', 'Available quote response must become an explicit Care result signal.');
assert(availableCare?.resultRef === 'quote_request:quote-request-1', 'Care stores a result reference, not quote payload.');

const selected = buildQuoteSelectedEvents({
  quoteRequestId: 'quote-request-1',
  occurredAt: '2026-09-17T22:30:00.000Z',
  sourceSequence: 3,
});
const selectedCanonical = parseCanonicalResourceChangeEvent(selected[0]);
const selectedCare = parseCareSignalEvent(selected[1]);
assert(selectedCanonical?.changeType === 'quote_request.selected', 'Selecting a quote must remain visible in canonical timeline.');
assert(selectedCare?.careEvent === 'require_follow_up', 'Selecting a quote must move the service journey toward the next action.');

const serialized = JSON.stringify([...opened, ...available, ...selected]).toLowerCase();
for (const forbidden of ['amountminor', 'phone', 'email', 'address', 'payment', 'sharetoken']) {
  assert(!serialized.includes(forbidden), `Quote lifecycle integration events must not copy ${forbidden}.`);
}

console.log('Service Exchange quote lifecycle event tests passed.');
