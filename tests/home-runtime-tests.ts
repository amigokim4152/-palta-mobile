import { mergeHomeSources } from '../src/home/mergeHomeSources.js';
import { projectHomeApiItem } from '../src/home/homeApiProjection.js';
import { WeatherHomeAdapter } from '../src/home/adapters/weatherHomeAdapter.js';
import { MobilityHomeAdapter } from '../src/home/adapters/mobilityHomeAdapter.js';
import { journeyToHome } from '../src/home/adapters/journeyHomeBridge.js';
import {
  municipalToHome,
  newsToHome,
} from '../src/home/adapters/publicLifeNewsHomeAdapters.js';
import type { JourneyResponse } from '../src/journey/journeyContract.js';

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

const scheduledJourney: JourneyResponse = {
  status: 'GREEN',
  departure_time: '2026-09-17T15:20:00.000Z',
  origin: { lat: -33.385, lon: -70.575 },
  destination: { lat: -33.437, lon: -70.65 },
  public_modes: ['auto', 'transit', 'bicycle', 'pedestrian'],
  results: {
    auto: { status: 'NO_ROUTE', options: [] },
    transit: {
      status: 'OK',
      options: [
        {
          mode: 'transit',
          duration_seconds: 2400,
          distance_meters: 11000,
          transfers: 1,
          realtime: false,
          source: 'journey-core',
          legs: [
            {
              mode: 'walk',
              duration_seconds: 300,
              distance_meters: 350,
              realtime: false,
            },
            {
              mode: 'bus',
              duration_seconds: 900,
              distance_meters: 5500,
              route_id: '405',
              route_name: '405',
              provider: 'DTPM',
              realtime: false,
            },
            {
              mode: 'metro',
              duration_seconds: 900,
              distance_meters: 4800,
              route_id: 'L1',
              route_name: 'L1',
              provider: 'Metro',
              realtime: false,
            },
          ],
        },
      ],
    },
    bicycle: { status: 'NO_ROUTE', options: [] },
    pedestrian: { status: 'NO_ROUTE', options: [] },
  },
};

const journeyHome = journeyToHome(
  {
    response: scheduledJourney,
    observedAt: now.toISOString(),
    expiresAt: '2026-09-17T15:10:00.000Z',
    destinationLabel: 'Santiago Centro',
    relevantNow: true,
    actionTarget: '/journey/current',
  },
  now,
);
assert(journeyHome.data_mode === 'scheduled', 'Scheduled Journey result must not be labelled live.');
assert((journeyHome.glance?.length ?? 0) === 0, 'Journey duration must not masquerade as stop-arrival glance ETA.');
assert(journeyHome.items?.[0]?.kind === 'action', 'A relevant near-departure Journey may become a Home action.');
assert(journeyHome.items?.[0]?.body?.includes('405 → L1'), 'Journey Home bridge should preserve useful normalized route names.');
assert(!journeyHome.items?.[0]?.body?.toLowerCase().includes('llega'), 'Journey bridge must not claim a bus arrival ETA.');

const unavailableJourney = journeyToHome({
  observedAt: now.toISOString(),
  relevantNow: true,
});
assert(unavailableJourney.data_mode === 'unavailable', 'Missing Journey result must be explicit unavailable.');
assert((unavailableJourney.items?.length ?? 0) === 0, 'Missing Journey result must not create transport timing cards.');

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
      sourceUrl: 'https://vitacura.cl/beneficio-vigente/',
    },
    {
      id: 'unverified-benefit',
      title: 'No mostrar',
      verification: 'needs_verification',
      localityMatches: true,
      eligibilityRelevant: true,
      validUntil: '2026-09-30T23:59:59.000Z',
    },
    {
      id: 'undated-benefit',
      title: 'Sin fecha ni estado permanente',
      verification: 'verified',
      localityMatches: true,
      eligibilityRelevant: true,
    },
    {
      id: 'ongoing-service',
      title: 'Servicio permanente',
      verification: 'corroborated',
      localityMatches: true,
      eligibilityRelevant: true,
      ongoing: true,
    },
  ],
}, now);
assert(publicLife.items?.length === 2, 'Only dated/current or explicitly ongoing verified municipal records may enter Home.');
assert(publicLife.items?.some((item) => item.related_entity_id === 'verified-benefit'), 'Verified current municipal record should survive filtering.');
assert(!publicLife.items?.some((item) => item.related_entity_id === 'undated-benefit'), 'Undated municipal records must remain out of Home.');

const verifiedBenefit = publicLife.items?.find(
  (item) => item.related_entity_id === 'verified-benefit',
);
assert(verifiedBenefit?.action_kind === 'external', 'Municipal source URL should become an external Home action.');
const projectedBenefit = projectHomeApiItem(verifiedBenefit!);
assert(projectedBenefit.domain === 'public-life', 'Projection must preserve the public-life domain.');
assert(projectedBenefit.action?.target === 'https://vitacura.cl/beneficio-vigente/', 'Projection must preserve the official external target.');

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
      sourceUrl: 'https://vitacura.cl/noticias/noticia-local-util/',
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
assert(news.items?.[0]?.action_target === 'https://vitacura.cl/noticias/noticia-local-util/', 'Current local news should retain its canonical source action.');

const expiredWeather = new WeatherHomeAdapter().toHome({
  dataMode: 'cached',
  observedAt: '2026-09-17T10:00:00.000Z',
  expiresAt: '2026-09-17T11:00:00.000Z',
  currentC: 14,
});

const merged = mergeHomeSources(
  [expiredWeather, weather, liveMobility, journeyHome, publicLife, news],
  { now, maxGlance: 4 },
);
assert(merged.locality_label === 'Vitacura', 'Home should preserve a current locality label.');
assert((merged.glance?.length ?? 0) <= 4, 'Glance must remain compact.');
assert(!merged.glance?.some((item) => item.value === '14°'), 'Expired source data must not reach Home.');
assert(merged.source_state?.some((item) => item.source_domain === 'mobility'), 'Source state must remain observable for QA.');

console.log('PASS: Home runtime source adapters');
