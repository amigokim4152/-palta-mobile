import type {
  HomeDataMode,
  HomeFunctionalItem,
  HomeGlanceSignal,
} from '../homeFunctionalContract.js';

export type WeatherFunctionalInput = {
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  currentC?: number;
  minC?: number;
  maxC?: number;
  conditionLabel?: string;
  precipitationProbabilityNextHours?: number;
  outdoorWindowRelevant?: boolean;
  severe?: boolean;
  severeSummary?: string;
};

export type WeatherFunctionalProjection = {
  glance: HomeGlanceSignal[];
  items: HomeFunctionalItem[];
};

function temperature(value: number | undefined): string | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value)}°`
    : undefined;
}

/**
 * Ordinary weather stays compact in Glance. Weather becomes a Home item only
 * when it materially changes today's plan: severe conditions or sufficiently
 * likely precipitation during a known relevant outdoor window.
 */
export function weatherToFunctionalHome(
  input: WeatherFunctionalInput,
): WeatherFunctionalProjection {
  if (input.dataMode === 'unavailable') {
    return { glance: [], items: [] };
  }

  const source = {
    domain: 'weather',
    mode: input.dataMode,
    observedAt: input.observedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  } as const;

  const current = temperature(input.currentC);
  const low = temperature(input.minC);
  const high = temperature(input.maxC);
  const detail = low && high ? `${low} / ${high}` : input.conditionLabel;

  const glance: HomeGlanceSignal[] = current
    ? [
        {
          id: 'weather-current',
          label: 'CLIMA',
          value: current,
          ...(detail ? { detail } : {}),
          ...(input.severe ? { exceptional: true } : {}),
          source,
        },
      ]
    : [];

  const items: HomeFunctionalItem[] = [];

  if (input.severe) {
    items.push({
      id: `weather-severe-${input.observedAt}`,
      surface: 'now',
      kind: 'alert',
      title: 'Condiciones meteorológicas importantes',
      body:
        input.severeSummary ??
        'Revisa las condiciones antes de salir y ajusta tus planes si es necesario.',
      source,
    });
  } else if (
    input.outdoorWindowRelevant &&
    typeof input.precipitationProbabilityNextHours === 'number' &&
    Number.isFinite(input.precipitationProbabilityNextHours) &&
    input.precipitationProbabilityNextHours >= 60
  ) {
    items.push({
      id: `weather-rain-${input.observedAt}`,
      surface: 'useful_today',
      kind: 'useful',
      title: 'Puede llover durante una salida relevante',
      body: `Probabilidad aproximada: ${Math.round(input.precipitationProbabilityNextHours)}%.`,
      source,
    });
  }

  return { glance, items };
}
