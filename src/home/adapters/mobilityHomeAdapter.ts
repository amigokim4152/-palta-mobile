import type { HomeApiItem } from '../../api/paltaApiClient.js';
import type { HomeDataMode } from '../homeRuntimeContract.js';
import type {
  HomeSourceAdapter,
  HomeSourceContribution,
} from '../homeSourceContract.js';

export type MobilityDeparture = {
  routeLabel: string;
  stopLabel?: string;
  minutes?: number;
  relevantNow: boolean;
  departureWindowActive: boolean;
};

export type MetroHomeStatus = {
  lineLabel: string;
  statusLabel: string;
  relevant: boolean;
  disrupted?: boolean;
  disruptionSummary?: string;
};

export type MobilityHomeInput = {
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  localityLabel?: string;
  departure?: MobilityDeparture;
  metro?: MetroHomeStatus;
};

export class MobilityHomeAdapter
  implements HomeSourceAdapter<MobilityHomeInput>
{
  readonly sourceDomain = 'mobility' as const;

  toHome(input: MobilityHomeInput): HomeSourceContribution {
    const base = {
      source_domain: this.sourceDomain,
      data_mode: input.dataMode,
      observed_at: input.observedAt,
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
      ...(input.localityLabel ? { locality_label: input.localityLabel } : {}),
    } as const;

    if (input.dataMode === 'unavailable') {
      return {
        ...base,
        message: 'Mobility source unavailable; no ETA may be fabricated.',
      };
    }

    const glance = [];
    const items: HomeApiItem[] = [];

    const departure = input.departure;
    if (
      departure?.relevantNow &&
      typeof departure.minutes === 'number' &&
      Number.isFinite(departure.minutes) &&
      departure.minutes >= 0
    ) {
      glance.push({
        id: `bus-${departure.routeLabel}`,
        label: `BUS ${departure.routeLabel}`,
        value: `${Math.round(departure.minutes)} min`,
        ...(departure.stopLabel ? { detail: departure.stopLabel } : {}),
      });

      if (departure.departureWindowActive && departure.minutes <= 5) {
        items.push({
          id: `departure-${departure.routeLabel}-${input.observedAt}`,
          kind: 'action',
          title: `Tu bus ${departure.routeLabel} está por llegar`,
          body: departure.stopLabel
            ? `Llegada estimada en ${Math.round(departure.minutes)} min · ${departure.stopLabel}`
            : `Llegada estimada en ${Math.round(departure.minutes)} min.`,
          source_domain: 'mobility',
          delivery: 'home',
        });
      }
    }

    const metro = input.metro;
    if (metro?.relevant) {
      glance.push({
        id: `metro-${metro.lineLabel}`,
        label: `METRO ${metro.lineLabel}`,
        value: metro.statusLabel,
        exceptional: Boolean(metro.disrupted),
      });

      if (metro.disrupted) {
        items.push({
          id: `metro-disruption-${metro.lineLabel}-${input.observedAt}`,
          kind: 'alert',
          title: `Cambio en Metro ${metro.lineLabel}`,
          body:
            metro.disruptionSummary ??
            'Hay una alteración relevante en la línea que sueles usar.',
          source_domain: 'mobility',
          delivery: 'home_notify',
        });
      }
    }

    return {
      ...base,
      glance,
      items,
    };
  }
}
