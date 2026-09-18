import type {
  JourneyLeg,
  JourneyOption,
  JourneyResponse,
} from '../../journey/journeyContract.js';
import type { HomeFunctionalItem } from '../homeFunctionalContract.js';

export type JourneyFunctionalInput = {
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
    .filter(
      (option) =>
        Number.isFinite(option.duration_seconds) && option.duration_seconds > 0,
    )
    .sort((a, b) => a.duration_seconds - b.duration_seconds)[0];
}

function routeLabel(leg: JourneyLeg): string | undefined {
  if (leg.mode !== 'bus' && leg.mode !== 'metro' && leg.mode !== 'rail') {
    return undefined;
  }
  if (leg.route_name?.trim()) return leg.route_name.trim();
  if (leg.route_id?.trim()) return leg.route_id.trim();
  if (leg.mode === 'metro') return 'Metro';
  if (leg.mode === 'rail') return 'Tren';
  return 'Bus';
}

function describeOption(option: JourneyOption): string {
  const minutes = Math.max(1, Math.round(option.duration_seconds / 60));
  const routes = option.legs
    .map(routeLabel)
    .filter((value): value is string => Boolean(value));
  const parts = [`Aprox. ${minutes} min`];
  if (option.transfers > 0) {
    parts.push(
      `${option.transfers} ${
        option.transfers === 1 ? 'combinación' : 'combinaciones'
      }`,
    );
  }
  if (routes.length > 0) parts.push(routes.join(' → '));
  return parts.join(' · ');
}

/**
 * Projects a user-relevant route plan into Home without ever interpreting total
 * journey duration as stop-arrival ETA. Vehicle/stop realtime remains owned by
 * the Mobility realtime adapter.
 */
export function journeyToFunctionalHome(
  input: JourneyFunctionalInput,
  now = new Date(),
): HomeFunctionalItem[] {
  const response = input.response;
  if (!response || response.status === 'RED' || !input.relevantNow) return [];

  const option = bestTransitOption(response);
  if (!option) return [];

  const departureAt = Date.parse(response.departure_time);
  const minutesUntilDeparture = Number.isFinite(departureAt)
    ? (departureAt - now.getTime()) / 60_000
    : undefined;
  const departureSoon =
    minutesUntilDeparture !== undefined &&
    minutesUntilDeparture >= -5 &&
    minutesUntilDeparture <= 45;

  const destination = input.destinationLabel
    ? ` a ${input.destinationLabel}`
    : '';
  const actionAvailable = Boolean(input.actionTarget);

  return [
    {
      id: `journey-${response.departure_time}-${
        input.destinationLabel ?? 'transit'
      }`,
      surface: departureSoon ? 'now' : 'useful_today',
      kind: departureSoon
        ? actionAvailable
          ? 'action'
          : 'alert'
        : 'useful',
      title: departureSoon
        ? `Tu viaje${destination} se acerca`
        : `Ruta${destination}`,
      body: describeOption(option),
      source: {
        domain: 'mobility',
        mode: option.realtime ? 'live' : 'scheduled',
        observedAt: input.observedAt,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      },
      ...(input.actionTarget
        ? {
            action: {
              label: 'Ver ruta',
              target: input.actionTarget,
              kind: 'internal' as const,
            },
          }
        : {}),
      dedupeKey: `journey:${response.departure_time}:${
        input.destinationLabel ?? 'transit'
      }`,
      urgency: departureSoon ? 2 : 0,
      importance: 2,
      relevance: departureSoon ? 0.9 : 0.72,
    },
  ];
}
