import { careToHome } from '../src/home/adapters/careHomeAdapter.js';
import { scheduledEventsToHome } from '../src/home/adapters/scheduledEventHomeAdapter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-17T15:00:00.000Z');

const waiting = careToHome({
  track: {
    id: 'care-wait-1',
    intent_key: 'quote_request',
    state: 'wait',
    waiting_for: 'business_response',
    expected_at: '2026-09-18T15:00:00.000Z',
  },
  title: 'Cotización del taller',
  sourceDomain: 'local-business',
  observedAt: now.toISOString(),
});
assert(waiting.items?.[0]?.kind === 'status', 'Care waiting state must stay EN CURSO/status.');
assert(!waiting.items?.[0]?.scheduled_at, 'Care expected response time must not become a PRÓXIMO appointment.');
assert(waiting.items?.[0]?.care_track_id === 'care-wait-1', 'Care Home item must keep the track deep link.');

const result = careToHome({
  track: {
    id: 'care-result-1',
    intent_key: 'quote_request',
    state: 'result',
  },
  title: 'Cotización del taller',
  observedAt: now.toISOString(),
});
assert(result.items?.[0]?.kind === 'action', 'Care result must become an actionable Home item.');
assert(result.items?.[0]?.delivery === 'home_notify', 'A newly available Care result should qualify for Home notification delivery.');

const closed = careToHome({
  track: {
    id: 'care-outcome-1',
    intent_key: 'quote_request',
    state: 'outcome',
  },
  title: 'Cotización del taller',
  observedAt: now.toISOString(),
});
assert((closed.items?.length ?? 0) === 0, 'Closed Care outcomes must leave the active Home surface.');

const schedule = scheduledEventsToHome(
  {
    sourceDomain: 'school',
    dataMode: 'live',
    observedAt: now.toISOString(),
    events: [
      {
        id: 'school-confirmed',
        title: 'Entrega de documento',
        detail: 'Documento confirmado por la fuente.',
        scheduledAt: '2026-09-18T13:30:00.000Z',
        confirmed: true,
        actionTarget: '/school/document/school-confirmed',
      },
      {
        id: 'school-unconfirmed',
        title: 'No mostrar todavía',
        scheduledAt: '2026-09-19T13:30:00.000Z',
        confirmed: false,
      },
      {
        id: 'school-urgent',
        title: 'Acción próxima',
        scheduledAt: '2026-09-17T16:00:00.000Z',
        confirmed: true,
        actionRequired: true,
        attentionLeadMinutes: 120,
      },
    ],
  },
  now,
);
assert(schedule.items?.length === 2, 'Unconfirmed scheduled events must stay out of Home.');
const future = schedule.items?.find((item) => item.related_entity_id === 'school-confirmed');
assert(future?.kind === 'status' && Boolean(future.scheduled_at), 'Confirmed future event must remain a PRÓXIMO/status item.');
const urgent = schedule.items?.find((item) => item.related_entity_id === 'school-urgent');
assert(urgent?.kind === 'action', 'Required action inside its attention window must promote to AHORA/action.');

console.log('PASS: Home Care and scheduled-event separation');
