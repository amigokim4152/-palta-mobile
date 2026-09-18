import { canonicalEventIsDiscoverable, type CanonicalEvent } from '../src/discovery/canonicalDiscovery.js';
import { validateDiscoveryDataSource } from '../src/discovery/dataSourceRegistry.js';
import { validateCommercialDeal, type CommercialDeal } from '../src/partners/commercialDeal.js';
import { panoramaMenuLabels } from '../src/play/panoramaIdentity.js';
import { canonicalizePlayDiscoveryItems } from '../src/play/playCanonicalization.js';
import { inferPlayContentKind } from '../src/play/playContentTaxonomy.js';
import { selectPlayDiscoveryItems, type PlayDiscoveryItem } from '../src/play/playDiscovery.js';
import { indexPlayCommercialCapabilities } from '../src/play/playCommercialCapability.js';
import { buildPanoramaNotificationCandidate } from '../src/play/playEventIntegration.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(panoramaMenuLabels.es === 'Panorama', 'Spanish official menu name must be Panorama');
assert(panoramaMenuLabels.ko === '즐길거리', 'Korean official menu name must be 즐길거리');
assert(panoramaMenuLabels.en === 'Things to do', 'English official menu name must be Things to do');
assert(panoramaMenuLabels.zh === '活动', 'Chinese official menu name must be 活动');
assert(!Object.values(panoramaMenuLabels).includes('놀자' as never), 'deprecated 놀자 label must not be used');
assert(inferPlayContentKind({ title: 'Biblioteca Pública de Vitacura' }) === 'library', 'library content must have a first-class taxonomy kind');

const municipalEvent: PlayDiscoveryItem = {
  id: 'municipal:e1',
  eventId: 'source-municipal-e1',
  sourceKind: 'municipal_event',
  contentKind: 'concert',
  title: 'Jazz al atardecer',
  comuna: 'Providencia',
  venue: 'Sala Ejemplo',
  scheduleLabel: 'Hoy · 20:00',
  startAt: '2026-09-18T20:00:00-03:00',
  travelTimeMinutes: 22,
  themeTags: ['today'],
  source: { authority: 'Municipalidad', sourceUrl: 'https://example.cl/agenda' },
};
const ticketEvent: PlayDiscoveryItem = {
  ...municipalEvent,
  id: 'ticket:e99',
  eventId: 'ticket-source-e99',
  sourceKind: 'partner_feed',
  travelTimeMinutes: 20,
  primaryAction: { kind: 'ticket', url: 'https://tickets.example/event', label: 'Ver entradas' },
  source: { authority: 'Ticket Partner', sourceUrl: 'https://tickets.example/event' },
};
const merged = canonicalizePlayDiscoveryItems([municipalEvent, ticketEvent]);
assert(merged.length === 1, 'same title + venue + exact showtime must merge across sources');
assert(merged[0]?.alternateSources?.length === 1, 'merged event must preserve corroborating source evidence');
assert(merged[0]?.primaryAction?.kind === 'ticket', 'operational ticket action from corroborating source must survive merge');
assert(merged[0]?.travelTimeMinutes === 20, 'merged discovery item must retain best resolved travel time');

const laterShow: PlayDiscoveryItem = {
  ...ticketEvent,
  id: 'ticket:e100',
  eventId: 'ticket-source-e100',
  startAt: '2026-09-18T22:00:00-03:00',
  scheduleLabel: 'Hoy · 22:00',
};
assert(canonicalizePlayDiscoveryItems([municipalEvent, laterShow]).length === 2, 'different showtimes must not collapse');

const closeItem: PlayDiscoveryItem = { ...municipalEvent, id: 'near', eventId: 'near', title: 'Cerca', travelTimeMinutes: 8 };
const farItem: PlayDiscoveryItem = { ...municipalEvent, id: 'far', eventId: 'far', title: 'Lejos', travelTimeMinutes: 35, sourceKind: 'public_program' };
assert(selectPlayDiscoveryItems([farItem, closeItem])[0]?.id === 'near', 'travel time must outrank public/private provenance in organic discovery');
const nearbyOnly = selectPlayDiscoveryItems([farItem, closeItem], {
  selectedTheme: 'nearby',
  maxNearbyTravelTimeMinutes: 15,
  maxNearbyDistanceM: 3_000,
});
assert(nearbyOnly.length === 1 && nearbyOnly[0]?.id === 'near', 'nearby intent must respect coarse distance/travel thresholds');

const libraryItem: PlayDiscoveryItem = {
  ...municipalEvent,
  id: 'library:1',
  eventId: undefined,
  contentKind: 'library',
  title: 'Biblioteca y cuentacuentos',
  travelTimeMinutes: 12,
  themeTags: ['family'],
};
assert(selectPlayDiscoveryItems([libraryItem], { selectedTheme: 'culture' }).length === 1, 'culture intent must include libraries');
const foodItem: PlayDiscoveryItem = {
  ...municipalEvent,
  id: 'food:1',
  eventId: undefined,
  contentKind: 'food_outing',
  title: 'Ruta gastronómica',
  themeTags: [],
};
assert(selectPlayDiscoveryItems([foodItem], { selectedTheme: 'food' }).length === 1, 'food intent must include food outings');

const candidate = buildPanoramaNotificationCandidate({
  item: municipalEvent,
  reason: 'nearby_today',
  occurredAt: '2026-09-18T15:00:00-03:00',
});
assert(candidate.type === 'notification.candidate', 'Panorama must hand notification evaluation to Event Core');
assert(candidate.payload.surface === 'panorama', 'Panorama notification candidates must identify their source surface');
assert(!('latitude' in candidate.payload) && !('longitude' in candidate.payload), 'Panorama notification candidates must not carry precise coordinates');

const event: CanonicalEvent = {
  eventId: 'canonical-e1',
  venueId: 'venue-1',
  organizerIds: ['org-1'],
  title: 'Obra de prueba',
  eventType: 'theatre',
  genres: ['Teatro'],
  startAt: '2026-09-18T18:00:00-03:00',
  endAt: '2026-09-18T19:00:00-03:00',
  price: { free: true },
  sourceEvidenceIds: ['ev-1'],
  verificationStatus: 'verified',
};
assert(canonicalEventIsDiscoverable(event, '2026-09-18T18:30:00-03:00'), 'active event must remain discoverable');
assert(!canonicalEventIsDiscoverable(event, '2026-09-18T19:01:00-03:00'), 'ended event must disappear from live discovery without deleting history');

assert(validateDiscoveryDataSource({
  sourceId: 'cl-culture-example',
  owner: 'Cultura oficial',
  sourceType: 'public_culture',
  coverageAreaIds: ['cl-rm'],
  officialLevel: 'authoritative_public',
  url: 'https://example.cl',
  collectorMethod: 'web_extract',
  refreshIntervalMinutes: 360,
  reliability: 'high',
  active: true,
}).length === 0, 'discovery source registry must accept a valid official cultural source');

const freeDeal: CommercialDeal = {
  dealId: 'deal-free-1',
  partnerType: 'venue',
  partnerId: 'venue-1',
  status: 'free',
  model: 'none',
  commissionRateBps: 0,
  userVisibleDisclosureRequired: false,
};
assert(validateCommercialDeal(freeDeal).length === 0, 'free launch partner still has a valid explicit CommercialDeal');
const commercialIndex = indexPlayCommercialCapabilities([
  {
    capabilityId: 'cap-1',
    discoveryItemId: 'municipal:e1',
    commercialDealId: 'deal-free-1',
    actionKind: 'ticket',
    destinationUrl: 'https://tickets.example/event',
    enabled: true,
  },
], [freeDeal], '2026-09-18T12:00:00-03:00');
assert(commercialIndex.get('municipal:e1')?.length === 1, 'commercial action may attach after discovery selection even when deal is free');

console.log('PASS: Panorama canonical discovery contracts');
