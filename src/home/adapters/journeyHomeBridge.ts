import type { HomeApiItem } from '../../api/paltaApiClient.js';
import type { JourneyLeg, JourneyOption, JourneyResponse } from '../../journey/journeyContract.js';
import type { HomeSourceContribution } from '../homeSourceContract.js';

export type JourneyHomeInput = {
  response?: JourneyResponse;
  observedAt: string;
  expiresAt?: string;
  destinationLabel?: string;
  relevantNow: boolean;
  actionTarget?: string;
};

function bestTransitOption(response: JourneyResponse): JourneyOption | undefined {
  const transit = response.results.transit;
  if (transit.status !== 'OK') return undefined;
  return [...transit.options]
    .filter((option) => Number.isFinite(option.duration_seconds) && option.duration_seconds > 0)
    .sort((a, b) => a.duration_seconds - b.duration_seconds)[0];
}

function routeLabel(leg: JourneyLeg): string | undefined {
  if (leg.mode !== 'bus' && leg.mode !== 'metro' && leg.mode !== 'rail') return undefined;
  if (leg.route_name?.trim()) return leg.route_name.trim();
  if (leg.route_id?.trim()) return leg.route_id.trim();
  if (leg.mode === 'metro') return 'Metro';
  if (leg.mode === 'rail') return 'Tren';
  return 'Bus';
}

function describeOption(option: JourneyOption): string {
  const minutes = Math.max(1, Math.round(option.duration_seconds / 60));
  const routes = option.legs.map(routeLabel).filter((value): value is string => Boolean(value));
  const parts = [`Aprox. ${minutes} min`];
  if (option.transfers > 0) {
    parts.push(`${option.transfers} ${option.transfers === 1 ? 'combinación' : 'combinaciones'}`);
  }
  if (routes.length > 0) parts.push(routes.join(' → '));
  return parts.join(' · ');
}

/**
 * Bridge the existing Journey contract into Home without inventing stop-arrival ETA.
 *
 * Journey gives route/trip duration and whether the option used realtime data.
 * It does NOT give "bus arrives in N minutes". Stop-arrival ETA remains a separate
 * DTPM/realtime source and must enter Home through MobilityHomeAdapter.
 */
export function journeyToHome(input: JourneyHomeInput, now = new Date()): HomeSourceContribution {
  const response = input.response;
  if (!response || response.status === 'RED') {
    return {
      source_domain: 'mobility',
      data_mode: 'unavailable',
      observed_at: input.observedAt,
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
      message: 'Journey route information unavailable; no transport timing was fabricated.',
    };
  }

  const option = bestTransitOption(response);
  if (!option) {
    return {
      source_domain: 'mobility',
      data_mode: 'unavailable',
      observed_at: input.observedAt,
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
      message: 'No usable transit route is currently available.',
    };
  }

  const dataMode = option.realtime ? ('live' as const) : ('scheduled' as const);
  const departureAt = Date.parse(response.departure_time);
  const minutesUntilDeparture = Number.isFinite(departureAt)
    ? (departureAt - now.getTime()) / 60_000
    : undefined;
  const departureSoon =
    input.relevantNow &&
    minutesUntilDeparture !== undefined &&
    minutesUntilDeparture >= -5 &&
    minutesUntilDeparture <= 45;

  const items: HomeApiItem[] = [];
  if (input.relevantNow) {
    const destination = input.destinationLabel ? ` a ${input.destinationLabel}` : '';
    items.push({
      id: `journey-${response.departure_time}-${input.destinationLabel ?? 'transit'}`,
      kind: departureSoon ? 'action' : 'useful_today',
      title: departureSoon ? `Tu viaje${destination} se acerca` : `Ruta${destination}`,
      body: describeOption(option),
      source_domain: 'mobility',
      delivery: departureSoon ? 'home_notify' : 'home',
      ...(input.actionTarget
        ? {
            action_label: 'Ver ruta',
            action_target: input.actionTarget,
            action_kind: 'internal' as const,
          }
        : {}),
    });
  }

  return {
    source_domain: 'mobility',
    data_mode: dataMode,
    observed_at: input.observedAt,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    items,
    ...(response.status === 'YELLOW'
      ? { message: 'Journey is available with partial/degraded source coverage.' }
      : {}),
  };
}
