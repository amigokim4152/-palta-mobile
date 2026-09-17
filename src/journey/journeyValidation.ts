import {
  JOURNEY_LEG_MODES,
  JOURNEY_PUBLIC_MODES,
  type JourneyCoordinate,
  type JourneyLeg,
  type JourneyModeResult,
  type JourneyOption,
  type JourneyPublicMode,
  type JourneyResponse,
} from './journeyContract.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCoordinate(value: unknown): value is JourneyCoordinate {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.lat) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    isFiniteNumber(value.lon) &&
    value.lon >= -180 &&
    value.lon <= 180
  );
}

function isPublicMode(value: unknown): value is JourneyPublicMode {
  return (
    typeof value === 'string' &&
    (JOURNEY_PUBLIC_MODES as readonly string[]).includes(value)
  );
}

function isLegMode(value: unknown): value is JourneyLeg['mode'] {
  return (
    typeof value === 'string' &&
    (JOURNEY_LEG_MODES as readonly string[]).includes(value)
  );
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isLeg(value: unknown): value is JourneyLeg {
  if (!isRecord(value)) return false;
  return (
    isLegMode(value.mode) &&
    isFiniteNumber(value.duration_seconds) &&
    value.duration_seconds >= 0 &&
    isFiniteNumber(value.distance_meters) &&
    value.distance_meters >= 0 &&
    typeof value.realtime === 'boolean' &&
    isNullableString(value.from_name) &&
    isNullableString(value.to_name) &&
    isNullableString(value.route_id) &&
    isNullableString(value.route_name) &&
    isNullableString(value.provider)
  );
}

function isOption(value: unknown): value is JourneyOption {
  if (!isRecord(value)) return false;
  return (
    isPublicMode(value.mode) &&
    isFiniteNumber(value.duration_seconds) &&
    value.duration_seconds >= 0 &&
    isFiniteNumber(value.distance_meters) &&
    value.distance_meters >= 0 &&
    Array.isArray(value.legs) &&
    value.legs.every(isLeg) &&
    Number.isInteger(value.transfers) &&
    (value.transfers as number) >= 0 &&
    typeof value.realtime === 'boolean' &&
    (value.source === null || typeof value.source === 'string')
  );
}

function isModeResult(value: unknown): value is JourneyModeResult {
  if (!isRecord(value)) return false;
  return (
    (value.status === 'OK' ||
      value.status === 'NO_ROUTE' ||
      value.status === 'ERROR') &&
    Array.isArray(value.options) &&
    value.options.every(isOption) &&
    isNullableString(value.error)
  );
}

function hasExactlyPublicModes(value: unknown): value is JourneyPublicMode[] {
  if (!Array.isArray(value) || value.length !== JOURNEY_PUBLIC_MODES.length) {
    return false;
  }
  if (!value.every(isPublicMode)) return false;
  return JOURNEY_PUBLIC_MODES.every((mode) => value.includes(mode));
}

export function parseJourneyResponse(value: unknown): JourneyResponse {
  if (!isRecord(value)) {
    throw new Error('Journey API returned a non-object payload');
  }

  if (
    value.status !== 'GREEN' &&
    value.status !== 'YELLOW' &&
    value.status !== 'RED'
  ) {
    throw new Error('Journey API returned an invalid overall status');
  }

  if (typeof value.departure_time !== 'string' || value.departure_time.length === 0) {
    throw new Error('Journey API payload missing departure_time');
  }

  if (!isCoordinate(value.origin) || !isCoordinate(value.destination)) {
    throw new Error('Journey API returned invalid coordinates');
  }

  if (!hasExactlyPublicModes(value.public_modes)) {
    throw new Error('Journey API public_modes do not match v1 contract');
  }

  if (!isRecord(value.results)) {
    throw new Error('Journey API payload missing results');
  }

  for (const mode of JOURNEY_PUBLIC_MODES) {
    if (!isModeResult(value.results[mode])) {
      throw new Error(`Journey API returned invalid result for ${mode}`);
    }
  }

  if (Object.keys(value.results).some((mode) => !isPublicMode(mode))) {
    throw new Error('Journey API returned a non-public mode');
  }

  return value as JourneyResponse;
}
