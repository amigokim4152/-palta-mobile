const DEFAULT_CACHE_MS = 15 * 60 * 1000;
let cached = null;

function conditionLabel(code) {
  if (code === 0) return 'Despejado';
  if (code === 1 || code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Niebla';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Llovizna';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Lluvia';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Nieve';
  if ([95, 96, 99].includes(code)) return 'Tormenta';
  return 'Condición variable';
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export async function getDevelopmentWeatherHome({
  latitude,
  longitude,
  localityLabel,
  now = new Date(),
  cacheMs = DEFAULT_CACHE_MS,
}) {
  if (cached && cached.key === `${latitude},${longitude}` && cached.expiresAt > now.getTime()) {
    return cached.value;
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'America/Santiago',
    forecast_days: '1',
  });

  const observedAt = now.toISOString();

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      signal: AbortSignal.timeout(4500),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

    const payload = await response.json();
    const currentC = finite(payload?.current?.temperature_2m);
    const minC = finite(payload?.daily?.temperature_2m_min?.[0]);
    const maxC = finite(payload?.daily?.temperature_2m_max?.[0]);
    const precipitationProbability = finite(payload?.daily?.precipitation_probability_max?.[0]);
    const weatherCode = finite(payload?.current?.weather_code);

    if (currentC === undefined) throw new Error('Open-Meteo current temperature missing');

    const expiresAt = new Date(now.getTime() + cacheMs).toISOString();
    const detail =
      minC !== undefined && maxC !== undefined
        ? `${Math.round(minC)}° / ${Math.round(maxC)}°`
        : weatherCode !== undefined
          ? conditionLabel(weatherCode)
          : undefined;

    const value = {
      sourceState: {
        source_domain: 'weather',
        data_mode: 'live',
        observed_at: observedAt,
        expires_at: expiresAt,
      },
      glance: {
        id: 'weather-current',
        label: 'HOY',
        value: `${Math.round(currentC)}°`,
        ...(detail ? { detail } : {}),
        source_domain: 'weather',
        data_mode: 'live',
        observed_at: observedAt,
        expires_at: expiresAt,
      },
      precipitationProbability,
      localityLabel,
    };

    cached = {
      key: `${latitude},${longitude}`,
      expiresAt: now.getTime() + cacheMs,
      value,
    };
    return value;
  } catch (error) {
    return {
      sourceState: {
        source_domain: 'weather',
        data_mode: 'unavailable',
        observed_at: observedAt,
        message: error instanceof Error ? error.message : 'Weather source unavailable',
      },
      glance: null,
      precipitationProbability: undefined,
      localityLabel,
    };
  }
}
