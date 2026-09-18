import type {
  JourneyModeResult,
  JourneyResponse,
} from '../src/journey/journeyContract.js';
import { journeyToFunctionalHome } from '../src/home/adapters/journeyFunctionalAdapter.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function noRoute(): JourneyModeResult {
  return { status: 'NO_ROUTE', options: [] };
}

function response(overrides: Partial<JourneyResponse> = {}): JourneyResponse {
  return {
    status: 'GREEN',
    departure_time: '2026-09-18T12:30:00.000Z',
    origin: { lat: -33.4, lon: -70.6 },
    destination: { lat: -33.45, lon: -70.65 },
    public_modes: ['auto', 'transit', 'bicycle', 'pedestrian'],
    results: {
      auto: noRoute(),
      bicycle: noRoute(),
      pedestrian: noRoute(),
      transit: {
        status: 'OK',
        options: [
          {
            mode: 'transit',
            duration_seconds: 35 * 60,
            distance_meters: 12_000,
            transfers: 1,
            realtime: true,
            source: 'journey-test',
            legs: [
              {
                mode: 'walk',
                duration_seconds: 5 * 60,
                distance_meters: 400,
                realtime: false,
              },
              {
                mode: 'bus',
                duration_seconds: 15 * 60,
                distance_meters: 7_000,
                route_name: '405',
                realtime: true,
              },
              {
                mode: 'metro',
                duration_seconds: 15 * 60,
                distance_meters: 4_600,
                route_name: 'L1',
                realtime: true,
              },
            ],
          },
        ],
      },
    },
    ...overrides,
  };
}

const now = new Date('2026-09-18T12:00:00.000Z');

const withTarget = journeyToFunctionalHome(
  {
    response: response(),
    observedAt: '2026-09-18T11:59:00.000Z',
    destinationLabel: 'Providencia',
    relevantNow: true,
    actionTarget: '/journey/current',
  },
  now,
);
assert(withTarget.length === 1, 'Relevant Journey route should produce one Home item.');
assert(withTarget[0]?.surface === 'now', 'Departure inside attention window belongs in AHORA.');
assert(withTarget[0]?.kind === 'action', 'Exact route target allows an actionable Journey item.');
assert(withTarget[0]?.action?.target === '/journey/current', 'Journey action must preserve exact route target.');
assert(withTarget[0]?.body?.includes('Aprox. 35 min'), 'Body should describe total route duration.');
assert(withTarget[0]?.body?.includes('405 → L1'), 'Body may summarize route sequence.');
assert(
  !withTarget[0]?.body?.toLowerCase().includes('llega en'),
  'Total Journey duration must never be worded as vehicle stop-arrival ETA.',
);
assert(validateHomeFunctionalItem(withTarget[0]!).length === 0, 'Journey projection must satisfy Home contract.');

const withoutTarget = journeyToFunctionalHome(
  {
    response: response(),
    observedAt: '2026-09-18T11:59:00.000Z',
    relevantNow: true,
  },
  now,
);
assert(withoutTarget[0]?.kind === 'alert', 'Imminent Journey without exact target must be alert, not fake action.');
assert(withoutTarget[0]?.action === undefined, 'Alert without route target must not fabricate an action.');
assert(validateHomeFunctionalItem(withoutTarget[0]!).length === 0, 'Non-action Journey alert must remain valid.');

const later = journeyToFunctionalHome(
  {
    response: response({ departure_time: '2026-09-18T14:00:00.000Z' }),
    observedAt: '2026-09-18T11:59:00.000Z',
    destinationLabel: 'Providencia',
    relevantNow: true,
    actionTarget: '/journey/current',
  },
  now,
);
assert(later[0]?.surface === 'useful_today', 'Relevant but non-imminent route belongs in PARA HOY.');
assert(later[0]?.kind === 'useful', 'Non-imminent route should not demand immediate action.');

const irrelevant = journeyToFunctionalHome({
  response: response(),
  observedAt: now.toISOString(),
  relevantNow: false,
});
assert(irrelevant.length === 0, 'Journey route should not occupy Home when not relevant now.');

const unavailable = journeyToFunctionalHome({
  response: response({ status: 'RED' }),
  observedAt: now.toISOString(),
  relevantNow: true,
});
assert(unavailable.length === 0, 'RED Journey response must not fabricate route timing.');

const noTransit = response();
noTransit.results.transit = { status: 'NO_ROUTE', options: [] };
assert(
  journeyToFunctionalHome({ response: noTransit, observedAt: now.toISOString(), relevantNow: true }, now).length === 0,
  'No transit route means no Journey Home item.',
);

console.log('PASS: Journey -> Home functional projection tests');
