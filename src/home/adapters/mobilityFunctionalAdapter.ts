import type {
  HomeDataMode,
  HomeFunctionalItem,
  HomeGlanceSignal,
} from '../homeFunctionalContract.js';

export type MobilityDepartureSignal = {
  routeLabel: string;
  stopLabel?: string;
  minutes?: number;
  relevantNow: boolean;
  departureWindowActive: boolean;
  realtimeVerified: boolean;
};

export type MetroFunctionalStatus = {
  lineLabel: string;
  statusLabel: string;
  relevant: boolean;
  disrupted?: boolean;
  disruptionSummary?: string;
};

export type MobilityFunctionalInput = {
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  departure?: MobilityDepartureSignal;
  metro?: MetroFunctionalStatus;
};

export type MobilityFunctionalProjection = {
  glance: HomeGlanceSignal[];
  items: HomeFunctionalItem[];
};

/**
 * Stop-arrival ETA and Metro status are operational signals. A route planner's
 * total trip duration must never be passed here as stop ETA.
 */
export function mobilityToFunctionalHome(
  input: MobilityFunctionalInput,
): MobilityFunctionalProjection {
  if (input.dataMode === 'unavailable') return { glance: [], items: [] };

  const source = {
    domain: 'mobility',
    mode: input.dataMode,
    observedAt: input.observedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  } as const;

  const glance: HomeGlanceSignal[] = [];
  const items: HomeFunctionalItem[] = [];

  const departure = input.departure;
  if (
    departure?.relevantNow &&
    departure.realtimeVerified &&
    typeof departure.minutes === 'number' &&
    Number.isFinite(departure.minutes) &&
    departure.minutes >= 0
  ) {
    glance.push({
      id: `bus-${departure.routeLabel}`,
      label: `BUS ${departure.routeLabel}`,
      value: `${Math.round(departure.minutes)} min`,
      ...(departure.stopLabel ? { detail: departure.stopLabel } : {}),
      source,
    });

    if (departure.departureWindowActive && departure.minutes <= 5) {
      items.push({
        id: `departure-${departure.routeLabel}-${input.observedAt}`,
        surface: 'now',
        kind: 'action',
        title: `Tu bus ${departure.routeLabel} está por llegar`,
        body: departure.stopLabel
          ? `Llegada estimada en ${Math.round(departure.minutes)} min · ${departure.stopLabel}`
          : `Llegada estimada en ${Math.round(departure.minutes)} min.`,
        source,
      });
    }
  }

  const metro = input.metro;
  if (metro?.relevant) {
    glance.push({
      id: `metro-${metro.lineLabel}`,
      label: `METRO ${metro.lineLabel}`,
      value: metro.statusLabel,
      ...(metro.disrupted ? { exceptional: true } : {}),
      source,
    });

    if (metro.disrupted) {
      items.push({
        id: `metro-disruption-${metro.lineLabel}-${input.observedAt}`,
        surface: 'now',
        kind: 'alert',
        title: `Cambio en Metro ${metro.lineLabel}`,
        body:
          metro.disruptionSummary ??
          'Hay una alteración relevante en la línea que sueles usar.',
        source,
      });
    }
  }

  return { glance, items };
}
