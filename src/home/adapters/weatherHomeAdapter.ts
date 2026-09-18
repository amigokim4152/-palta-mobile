import type { HomeApiItem } from '../../api/paltaApiClient.js';
import type { HomeDataMode } from '../homeRuntimeContract.js';
import type {
  HomeSourceAdapter,
  HomeSourceContribution,
} from '../homeSourceContract.js';

export type WeatherHomeInput = {
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  localityLabel?: string;
  currentC?: number;
  minC?: number;
  maxC?: number;
  conditionLabel?: string;
  precipitationProbabilityNextHours?: number;
  outdoorWindowRelevant?: boolean;
  severe?: boolean;
  severeSummary?: string;
};

function temperature(value: number | undefined): string | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value)}°`
    : undefined;
}

export class WeatherHomeAdapter implements HomeSourceAdapter<WeatherHomeInput> {
  readonly sourceDomain = 'weather' as const;

  toHome(input: WeatherHomeInput): HomeSourceContribution {
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
        message: 'Weather source unavailable; Home must not invent weather values.',
      };
    }

    const current = temperature(input.currentC);
    const low = temperature(input.minC);
    const high = temperature(input.maxC);
    const detail = low && high ? `${low} / ${high}` : input.conditionLabel;

    const glance = current
      ? [
          {
            id: 'weather-current',
            label: 'HOY',
            value: current,
            ...(detail ? { detail } : {}),
            exceptional: Boolean(input.severe),
          },
        ]
      : [];

    const items: HomeApiItem[] = [];

    if (input.severe) {
      items.push({
        id: `weather-severe-${input.observedAt}`,
        kind: 'alert',
        title: 'Condiciones meteorológicas importantes',
        body:
          input.severeSummary ??
          'Revisa las condiciones antes de salir y ajusta tus planes si es necesario.',
        source_domain: 'weather',
        delivery: 'home_notify',
      });
    } else if (
      input.outdoorWindowRelevant &&
      typeof input.precipitationProbabilityNextHours === 'number' &&
      input.precipitationProbabilityNextHours >= 60
    ) {
      items.push({
        id: `weather-rain-${input.observedAt}`,
        kind: 'useful_today',
        title: 'Puede llover durante una salida relevante',
        body: `Probabilidad aproximada: ${Math.round(
          input.precipitationProbabilityNextHours,
        )}%.`,
        source_domain: 'weather',
        delivery: 'home',
      });
    }

    return {
      ...base,
      glance,
      items,
    };
  }
}
