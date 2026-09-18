import { canRenderGlanceSignal } from '../src/home/homeCachePolicy.js';
import { weatherToFunctionalHome } from '../src/home/adapters/weatherFunctionalAdapter.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ordinary = weatherToFunctionalHome({
  dataMode: 'live',
  observedAt: '2026-09-18T12:00:00.000Z',
  expiresAt: '2026-09-18T12:15:00.000Z',
  currentC: 18.4,
  minC: 10.2,
  maxC: 23.7,
  conditionLabel: 'Despejado',
});
assert(ordinary.glance.length === 1, 'Ordinary weather should appear in Glance.');
assert(ordinary.glance[0]?.value === '18°', 'Weather temperature should be compactly rounded.');
assert(ordinary.items.length === 0, 'Ordinary weather must not create a large Home card.');

const relevantRain = weatherToFunctionalHome({
  dataMode: 'cached',
  observedAt: '2026-09-18T12:00:00.000Z',
  expiresAt: '2026-09-18T12:15:00.000Z',
  currentC: 16,
  precipitationProbabilityNextHours: 75,
  outdoorWindowRelevant: true,
});
assert(relevantRain.items.length === 1, 'Relevant likely rain should create one useful-today item.');
assert(relevantRain.items[0]?.surface === 'useful_today', 'Relevant rain belongs in PARA HOY.');
assert(relevantRain.items[0]?.kind === 'useful', 'Relevant rain should be useful context, not an urgent alert.');
assert(validateHomeFunctionalItem(relevantRain.items[0]!).length === 0, 'Relevant rain item must satisfy Home contract.');

const irrelevantRain = weatherToFunctionalHome({
  dataMode: 'live',
  observedAt: '2026-09-18T12:00:00.000Z',
  currentC: 16,
  precipitationProbabilityNextHours: 90,
  outdoorWindowRelevant: false,
});
assert(irrelevantRain.items.length === 0, 'High rain probability alone should not create a Home card without relevant life context.');

const severe = weatherToFunctionalHome({
  dataMode: 'live',
  observedAt: '2026-09-18T12:00:00.000Z',
  expiresAt: '2026-09-18T12:10:00.000Z',
  currentC: 8,
  severe: true,
  severeSummary: 'Viento fuerte en tu zona.',
});
assert(severe.items[0]?.surface === 'now' && severe.items[0]?.kind === 'alert', 'Severe weather should promote to AHORA alert.');
assert(severe.glance[0]?.exceptional === true, 'Severe weather should also mark Glance as exceptional.');

const unavailable = weatherToFunctionalHome({
  dataMode: 'unavailable',
  observedAt: '2026-09-18T12:00:00.000Z',
  currentC: 22,
  severe: true,
});
assert(unavailable.glance.length === 0 && unavailable.items.length === 0, 'Unavailable weather source must not leak stale/demo values into Home.');

assert(
  !canRenderGlanceSignal(
    severe.glance[0]!,
    new Date('2026-09-18T12:11:00.000Z'),
  ),
  'Expired weather Glance must disappear instead of looking current.',
);

console.log('PASS: Weather -> Home functional projection tests');
