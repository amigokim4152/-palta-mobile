import {
  projectVehicleCoordinationForDealer,
  validateVehicleCoordinationSelection,
  validateVehicleInspectionCoordination,
} from '../src/autos/autosAcquisitionCoordination.js';
import {
  evaluateDealerForAcquisition,
  routeEligibleDealers,
  type AutosDealerRegistryEntry,
} from '../src/autos/autosDealerRegistry.js';
import {
  buildVehicleSaleCareTrack,
  validateVehicleSaleMilestones,
} from '../src/autos/autosSaleCare.js';
import {
  mergeVehicleIdentitySnapshots,
  type ChileVehicleIdentitySnapshot,
} from '../src/autos/chileVehicleData.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const dealer = (
  businessId: string,
  overrides: Partial<AutosDealerRegistryEntry> = {},
): AutosDealerRegistryEntry => ({
  businessId,
  legalOrTradeName: businessId,
  comuna: 'Providencia',
  regionCode: 'CL-RM',
  source: 'cavem_public_directory',
  sourceRef: 'https://www.cavem.cl/socios_centro',
  verification: 'verified',
  capabilities: ['vehicle_private_buy_bid'],
  acquisition: {
    enabled: true,
    serviceComunas: ['Providencia', 'Las Condes', 'Vitacura'],
    minYear: 2015,
    maxMileageKm: 180_000,
  },
  ...overrides,
});

const request = {
  requestId: 'request-001',
  comuna: 'Las Condes',
  make: 'Toyota',
  year: 2021,
  mileageKm: 48_200,
};

const eligible = evaluateDealerForAcquisition(dealer('biz-a'), request);
assert(eligible.eligible, 'Verified dealer with acquisition capability and service area should be eligible.');

const unverified = evaluateDealerForAcquisition(
  dealer('biz-b', { verification: 'unverified' }),
  request,
);
assert(!unverified.eligible && unverified.reasons.includes('dealer_not_verified'), 'CAVEM/public discovery must not grant Palta verification automatically.');

const noCapability = evaluateDealerForAcquisition(
  dealer('biz-c', { capabilities: ['vehicle_inventory_publish'] }),
  request,
);
assert(!noCapability.eligible && noCapability.reasons.includes('missing_private_buy_capability'), 'Inventory publishing alone must not allow private-car bidding.');

const outsideArea = evaluateDealerForAcquisition(
  dealer('biz-d', {
    acquisition: {
      enabled: true,
      serviceComunas: ['Maipú'],
    },
  }),
  request,
);
assert(!outsideArea.eligible && outsideArea.reasons.includes('outside_service_area'), 'Dealer routing must respect declared service area.');

const routedA = routeEligibleDealers(
  [dealer('biz-a'), dealer('biz-e'), dealer('biz-f'), dealer('biz-g')],
  request,
  3,
);
const routedB = routeEligibleDealers(
  [dealer('biz-g'), dealer('biz-f'), dealer('biz-e'), dealer('biz-a')],
  request,
  3,
);
assert(
  routedA.map((item) => item.businessId).join('|') === routedB.map((item) => item.businessId).join('|'),
  'Organic dealer routing should be deterministic and independent of input/listing order.',
);

const sourceA: ChileVehicleIdentitySnapshot = {
  plateMasked: 'LX••00',
  make: {
    value: 'Toyota',
    source: 'user_confirmed',
    confidence: 'declared',
    observedAt: '2026-09-18T10:00:00.000Z',
  },
  fiscalValueClp: {
    value: 15_000_000,
    source: 'sii_tasacion',
    confidence: 'verified',
    observedAt: '2026-01-22T00:00:00.000Z',
    effectiveYear: 2026,
  },
};
const sourceB: ChileVehicleIdentitySnapshot = {
  plateMasked: 'LX••00',
  make: {
    value: 'TOYOTA',
    source: 'partner_registry',
    confidence: 'verified',
    observedAt: '2026-09-18T11:00:00.000Z',
  },
};
const merged = mergeVehicleIdentitySnapshots([sourceA, sourceB]);
assert(merged?.make?.value === 'TOYOTA', 'Higher-confidence vehicle facts should win without erasing provenance.');
assert(merged?.fiscalValueClp?.value === 15_000_000, 'SII fiscal value should remain a separate sourced fact.');

const careRecords = [
  { milestone: 'offer_selected' as const, observedAt: '2026-09-18T12:00:00.000Z' },
  { milestone: 'inspection_scheduled' as const, observedAt: '2026-09-19T15:00:00.000Z' },
];
assert(validateVehicleSaleMilestones(careRecords).valid, 'Chronological sale milestones should validate.');
const care = buildVehicleSaleCareTrack({
  careId: 'care-sale-001',
  acquisitionRequestId: 'request-001',
  selectedOfferId: 'offer-001',
  records: careRecords,
});
assert(care.state === 'upcoming', 'Scheduled inspection should project into Shared Care upcoming state.');

const invalidCare = validateVehicleSaleMilestones([
  { milestone: 'transfer_started', observedAt: '2026-09-20T12:00:00.000Z' },
  { milestone: 'inspection_completed', observedAt: '2026-09-18T12:00:00.000Z' },
]);
assert(!invalidCare.valid, 'Out-of-order vehicle sale milestones must fail validation.');

const coordinationSelection = {
  acquisitionRequestId: 'request-001',
  selectedOfferId: 'offer-001',
  selectedBusinessId: 'biz-a',
  selectedAt: '2026-09-18T12:30:00.000Z',
  contactConsent: 'share_selected_dealer' as const,
  locationConsent: 'share_selected_dealer' as const,
};
const privateCoordination = {
  phone: '+56911112222',
  exactLocation: {
    latitude: -33.401,
    longitude: -70.58,
    label: 'Lugar acordado',
  },
};
assert(
  validateVehicleCoordinationSelection(coordinationSelection, privateCoordination).valid,
  'Explicit selected-dealer contact and location sharing should validate when the private facts exist.',
);
const selectedDealerProjection = projectVehicleCoordinationForDealer(
  coordinationSelection,
  privateCoordination,
  'biz-a',
);
assert(
  selectedDealerProjection.phone === '+56911112222' && Boolean(selectedDealerProjection.exactLocation),
  'Only the selected dealer may receive explicitly shared coordination details.',
);
const losingDealerProjection = projectVehicleCoordinationForDealer(
  coordinationSelection,
  privateCoordination,
  'biz-e',
);
assert(
  losingDealerProjection.selected === false && !losingDealerProjection.phone && !losingDealerProjection.exactLocation,
  'Losing bidders must never receive phone or exact location.',
);

const privateSelection = {
  ...coordinationSelection,
  contactConsent: 'private' as const,
  locationConsent: 'private' as const,
};
const stillPrivate = projectVehicleCoordinationForDealer(privateSelection, privateCoordination, 'biz-a');
assert(!stillPrivate.phone && !stillPrivate.exactLocation, 'Selecting a dealer must not automatically reveal private coordination facts.');

assert(
  validateVehicleInspectionCoordination(
    {
      venueMode: 'dealer_location',
      scheduledAt: '2026-09-19T15:00:00.000Z',
      contactConsent: 'private',
      locationConsent: 'private',
    },
    {},
  ).valid,
  'Inspection at the dealer should work without seller phone or exact location.',
);
assert(
  !validateVehicleInspectionCoordination(
    {
      venueMode: 'dealer_location',
      scheduledAt: '2026-09-19T15:00:00.000Z',
      contactConsent: 'private',
      locationConsent: 'share_selected_dealer',
    },
    privateCoordination,
  ).valid,
  'Dealer-location inspection must not unnecessarily share seller exact location.',
);
assert(
  !validateVehicleInspectionCoordination(
    {
      venueMode: 'seller_location',
      scheduledAt: '2026-09-19T15:00:00.000Z',
      contactConsent: 'private',
      locationConsent: 'private',
    },
    privateCoordination,
  ).valid,
  'Seller-location inspection must require explicit location consent.',
);
assert(
  validateVehicleInspectionCoordination(
    {
      venueMode: 'seller_location',
      scheduledAt: '2026-09-19T15:00:00.000Z',
      contactConsent: 'share_selected_dealer',
      locationConsent: 'share_selected_dealer',
    },
    privateCoordination,
  ).valid,
  'Seller-location inspection should validate only with the explicitly shared private facts.',
);

console.log('PASS: Autos dealer routing, Chile data merge, Shared Care and selected-dealer privacy projection');
