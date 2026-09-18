import type { ResolvedBusinessPlayExposure } from './businessPlayProjection.js';
import type { MunicipalEventPlayInput, MunicipalPlayProjectionContext } from './municipalEventProjection.js';
import type { PlayDiscoveryItem } from './playDiscovery.js';
import { assemblePlaySources, type PlaySourceAssembly } from './playSourceAssembler.js';

export type PlaySourceLocation = Readonly<{
  comuna?: string;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
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
  fetchedAt: string;
  version?: string;
}>;

/**
 * Infrastructure boundary for Play discovery.
 *
 * Implementations may read from a Worker snapshot, API, cache or another Palta
 * service, but the Play screen never knows which transport is used. Production
 * adapters must return normalized facts/projections only; they must not expose a
 * Base44-specific shape or the municipal engine's research-draft intake schema.
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
  if (request.location?.radiusM !== undefined && request.location.radiusM <= 0) {
    issues.push('radius_m_invalid');
  }
  return [...new Set(issues)];
}

export async function loadPlaySourceAssembly(input: {
  port: PlaySourcePort;
  request: PlaySourceRequest;
  calendar: MunicipalPlayProjectionContext;
}): Promise<PlaySourceAssembly> {
  const issues = validatePlaySourceRequest(input.request);
  if (issues.length) throw new Error(`invalid_play_source_request:${issues.join(',')}`);

  const snapshot = await input.port.readSnapshot(input.request);
  return assemblePlaySources({
    municipalEvents: snapshot.municipalEvents,
    businessExposures: snapshot.businessExposures,
    publicPrograms: snapshot.publicPrograms,
    calendar: input.calendar,
  });
}
