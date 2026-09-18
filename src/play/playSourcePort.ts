import type { ResolvedBusinessPlayExposure } from './businessPlayProjection.js';
import type {
  CanonicalDiscoveryCatalog,
  CanonicalPlayProjectionContext,
} from './canonicalDiscoveryProjection.js';
import type { MunicipalEventPlayInput, MunicipalPlayProjectionContext } from './municipalEventProjection.js';
import type { PlayDiscoveryItem } from './playDiscovery.js';
import { assemblePlaySources, type PlaySourceAssembly } from './playSourceAssembler.js';

export type PlaySourceLocation = Readonly<{
  comuna?: string;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  maxTravelTimeMinutes?: number;
}>;

export type PlaySourceRequest = Readonly<{
  location?: PlaySourceLocation;
  fromIsoDate: string;
  toIsoDate: string;
  locale: string;
}>;

export type PlaySourceSnapshot = Readonly<{
  municipalEvents: readonly MunicipalEventPlayInput[];
  businessExposures: readonly ResolvedBusinessPlayExposure[];
  publicPrograms: readonly PlayDiscoveryItem[];
  /** Canonical Venue/Event/Offering graph shared by Play, Map, Search and Business. */
  canonicalCatalog?: CanonicalDiscoveryCatalog;
  /** Normalized cinema/showtime, ticketing, tourism or editorial discovery items. */
  catalogItems?: readonly PlayDiscoveryItem[];
  fetchedAt: string;
  version?: string;
}>;

/**
 * Infrastructure boundary for Play discovery.
 * Provider-specific payloads never cross this boundary.
 */
export interface PlaySourcePort {
  readSnapshot(request: PlaySourceRequest): Promise<PlaySourceSnapshot>;
}

function validIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validatePlaySourceRequest(request: PlaySourceRequest): readonly string[] {
  const issues: string[] = [];
  if (!validIsoDate(request.fromIsoDate)) issues.push('from_date_invalid');
  if (!validIsoDate(request.toIsoDate)) issues.push('to_date_invalid');
  if (request.fromIsoDate > request.toIsoDate) issues.push('date_range_invalid');
  if (!request.locale.trim()) issues.push('locale_required');
  if (request.location?.radiusM !== undefined && request.location.radiusM <= 0) issues.push('radius_m_invalid');
  if (request.location?.maxTravelTimeMinutes !== undefined && request.location.maxTravelTimeMinutes <= 0) {
    issues.push('max_travel_time_invalid');
  }
  return [...new Set(issues)];
}

export async function loadPlaySourceAssembly(input: {
  port: PlaySourcePort;
  request: PlaySourceRequest;
  calendar: MunicipalPlayProjectionContext;
  canonicalContext?: CanonicalPlayProjectionContext;
}): Promise<PlaySourceAssembly> {
  const issues = validatePlaySourceRequest(input.request);
  if (issues.length) throw new Error(`invalid_play_source_request:${issues.join(',')}`);

  const snapshot = await input.port.readSnapshot(input.request);
  return assemblePlaySources({
    municipalEvents: snapshot.municipalEvents,
    businessExposures: snapshot.businessExposures,
    publicPrograms: snapshot.publicPrograms,
    ...(snapshot.canonicalCatalog && input.canonicalContext
      ? { canonicalCatalog: snapshot.canonicalCatalog, canonicalContext: input.canonicalContext }
      : {}),
    ...(snapshot.catalogItems ? { catalogItems: snapshot.catalogItems } : {}),
    calendar: input.calendar,
  });
}
