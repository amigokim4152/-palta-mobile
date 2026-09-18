import { mergeHomeSources } from '../src/home/mergeHomeSources.js';
import { WeatherHomeAdapter } from '../src/home/adapters/weatherHomeAdapter.js';
import { MobilityHomeAdapter } from '../src/home/adapters/mobilityHomeAdapter.js';
import {
  municipalToHome,
  newsToHome,
} from '../src/home/adapters/publicLifeNewsHomeAdapters.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-17T15:00:00.000Z');

const weather = new WeatherHomeAdapter().toHome({
  dataMode: 'live',
  observedAt: now.toISOString(),
  expiresAt: '2026-09-17T16:00:00.000Z',
  localityLabel: 'Vitacura',
  currentC: 18.4,
  minC: 10,
  maxC: 22,
  conditionLabel: 'Despejado',
});
assert(weather.glance?.[0]?.value === '18°', 'Weather must project a real supplied value.');

const unavailableMobility = new MobilityHomeAdapter().toHome({
  dataMode: 'unavailable',
  observedAt: now.toISOString(),
  departure: {
    routeLabel: '405',
    minutes: 4,
    relevantNow: true,
    departureWindowActive: true,
  },
});
assert((unavailableMobility.glance?.length ?? 0) === 0, 'Unavailable mobility must not expose ETA.');
assert((unavailableMobility.items?.length ?? 0) === 0, 'Unavailable mobility must not create action cards.');

const liveMobility = new MobilityHomeAdapter().toHome({
  dataMode: 'live',
  observedAt: now.toISOString(),
  expiresAt: '2026-09-17T15:02:00.000Z',
  departure: {
    routeLabel: '405',
    stopLabel: 'Parada habitual',
    minutes: 4,
    relevantNow: true,
    departureWindowActive: true,
  },
  metro: {
    lineLabel: 'L1',
    statusLabel: 'Normal',
    relevant: true,
  },
});
assert(liveMobility.glance?.some((item) => item.id === 'bus-405'), 'Relevant live bus ETA should enter glance.');
assert(liveMobility.items?.some((item) => item.kind === 'action'), 'Imminent relevant departure should become an action.');

const publicLife = municipalToHome({
  dataMode: 'scheduled',
  observedAt: now.toISOString(),
  localityLabel: 'Vitacura',
  records: [
    {
      id: 'verified-benefit',
      title: 'Beneficio vigente',
      verification: 'verified',
      localityMatches: true,
      eligibilityRelevant: true,
      validUntil: '2026-09-30T23:59:59.000Z',
    },
    {
      id: 'unverified-benefit',
      title: 'No mostrar',
      verification: 'needs_verification',
      localityMatches: true,
      eligibilityRelevant: true,
      validUntil: '2026-09-30T23:59:59.000Z',
    },
  ],
}, now);
assert(publicLife.items?.length === 1, 'Only verified/corroborated municipal records may enter Home.');
assert(publicLife.items?.[0]?.related_entity_id === 'verified-benefit', 'Verified municipal record should survive filtering.');

const news = newsToHome({
  dataMode: 'scheduled',
  observedAt: now.toISOString(),
  localityLabel: 'Vitacura',
  records: [
    {
      id: 'fresh-local',
      title: 'Noticia local útil',
      localityMatches: true,
      relevance: 0.9,
      publishedAt: '2026-09-17T12:00:00.000Z',
    },
    {
      id: 'old-local',
      title: 'Vieja',
      localityMatches: true,
      relevance: 0.9,
      publishedAt: '2026-09-10T12:00:00.000Z',
    },
    {
      id: 'other-place',
      title: 'Otra comuna',
      localityMatches: false,
      relevance: 1,
      publishedAt: '2026-09-17T12:00:00.000Z',
    },
  ],
}, now);
assert(news.items?.length === 1 && news.items[0]?.related_entity_id === 'fresh-local', 'News must be current, local and relevant.');

const expiredWeather = new WeatherHomeAdapter().toHome({
  dataMode: 'cached',
  observedAt: '2026-09-17T10:00:00.000Z',
  expiresAt: '2026-09-17T11:00:00.000Z',
  currentC: 14,
});

const merged = mergeHomeSources(
  [expiredWeather, weather, liveMobility, publicLife, news],
  { now, maxGlance: 4 },
);
assert(merged.locality_label === 'Vitacura', 'Home should preserve a current locality label.');
assert((merged.glance?.length ?? 0) <= 4, 'Glance must remain compact.');
assert(!merged.glance?.some((item) => item.value === '14°'), 'Expired source data must not reach Home.');
assert(merged.source_state?.some((item) => item.source_domain === 'mobility'), 'Source state must remain observable for QA.');

console.log('PASS: Home runtime source adapters');
