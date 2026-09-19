import type { HomeApiItem } from '../../../../src/api/paltaApiClient';

function demoItem(
  capabilityKey: string,
  sourceDomain: string,
  title: string,
  body: string,
  surface: 'now' | 'useful_today' = 'useful_today',
): HomeApiItem {
  return {
    id: `legacy-life-demo:${capabilityKey}`,
    capability_key: capabilityKey,
    kind: surface === 'now' ? 'alert' : 'content',
    title,
    body,
    source_domain: sourceDomain,
    delivery: 'home',
    surface,
    data_mode: 'demo',
    dedupe_key: `legacy-life:${capabilityKey}:demo`,
    relevance: surface === 'now' ? 0.9 : 0.68,
  };
}

/**
 * Development-only complete life-card fixtures.
 *
 * These are not production fallbacks. They exist so the operator can inspect
 * every Home capability before all canonical data sources are migrated.
 * Existing API items always win by capability_key; a fixture is injected only
 * when the current Home payload does not already contain that capability.
 */
export const LEGACY_LIFE_CARD_DEMO_ITEMS: readonly HomeApiItem[] = [
  demoItem('glance.precipitation', 'weather', 'Precipitación', 'Ejemplo: probabilidad de lluvia en las próximas horas.'),
  demoItem('glance.uv', 'weather', 'Índice UV', 'Ejemplo: nivel UV actual y máximo previsto para hoy.'),

  demoItem('today.palta_notice', 'palta-notice', 'Aviso de Somos Palta', 'Ejemplo: información pública de operación o servicio, separada de tus notificaciones privadas.'),
  demoItem('today.exchange_rate', 'economy', 'Tipo de cambio', 'Ejemplo: USD/CLP y la moneda personal seleccionada.'),
  demoItem('today.uf', 'economy', 'UF de hoy', 'Ejemplo: valor UF vigente y referencia de tendencia.'),
  demoItem('today.food_prices', 'food', 'Precios de alimentos', 'Ejemplo: referencia ODEPA para productos relevantes de tu zona.'),
  demoItem('today.nearby_food_available', 'food', 'Comida disponible ahora', 'Ejemplo: almuerzo, retiro o delivery que realmente está aceptando pedidos en este momento.'),
  demoItem('today.fuel_nearby', 'fuel', 'Bencina cerca de ti', 'Ejemplo: precios y cambios recientes en estaciones cercanas.'),
  demoItem('today.traffic_commute', 'traffic', 'Tránsito de tu recorrido', 'Ejemplo: demora respecto de lo normal y alternativa cuando corresponda.'),
  demoItem('today.vehicle_restriction', 'vehicle', 'Restricción vehicular', 'Ejemplo: restricción activa en RM cuando aplica a tu vehículo.'),
  demoItem('today.road_condition', 'road', 'Estado de rutas', 'Ejemplo: nieve, hielo, cadenas, restricción o cierre cuando corresponda.'),
  demoItem('today.border_crossing', 'border', 'Pasos fronterizos', 'Ejemplo: abierto, cerrado o restringido para pasos relevantes.'),
  demoItem('today.maritime_forecast', 'marine', 'Pronóstico marítimo', 'Ejemplo: condición marítima para costa o destino relevante.'),
  demoItem('today.marine_alert', 'marine', 'Aviso marítimo', 'Ejemplo: marejadas u otra alerta vigente en zona costera.'),
  demoItem('today.tide', 'marine', 'Mareas', 'Ejemplo: referencia de marea para costa o destino guardado.'),
  demoItem('today.daily_brief', 'news', 'Breves de hoy', 'Ejemplo: resumen corto de transporte, economía, seguridad, clima y cultura.'),
  demoItem('today.chile_annual_rhythm', 'local-life', 'Ritmo de Chile', 'Ejemplo: Fiestas Patrias, vendimias, temporada de nieve o vacaciones según la época.'),
  demoItem('today.interest_personalization', 'personalization', 'Para ti', 'Ejemplo: fútbol, running, ciclismo u otros intereses que hayas elegido cambian lo que Palta prioriza.'),

  demoItem('now.earthquake_alert', 'safety', 'Sismo relevante', 'Ejemplo: evento sísmico verificado que afecta tu zona.', 'now'),
  demoItem('now.tsunami_alert', 'safety', 'Alerta de tsunami', 'Ejemplo: alerta oficial visible solo para contexto costero relevante.', 'now'),
  demoItem('now.strong_wind', 'weather', 'Viento fuerte', 'Ejemplo: aviso de viento cuando cambia lo que conviene hacer.', 'now'),
  demoItem('now.snow_ice', 'road', 'Nieve o hielo', 'Ejemplo: condición que afecta traslado, ruta o actividad diaria.', 'now'),
  demoItem('now.wildfire_alert', 'safety', 'Alerta de incendio forestal', 'Ejemplo: riesgo o evento oficial relevante para tu sector.', 'now'),
  demoItem('now.river_flood_alert', 'safety', 'Riesgo de inundación', 'Ejemplo: alerta de río, quebrada o inundación relevante.', 'now'),
  demoItem('now.heat_cold', 'weather', 'Temperatura extrema', 'Ejemplo: calor o frío extremo con impacto práctico.', 'now'),
] as const;

export function missingLegacyLifeCardDemoItems(existingItems: readonly HomeApiItem[]): HomeApiItem[] {
  const existingCapabilities = new Set(
    existingItems
      .map((item) => item.capability_key)
      .filter((key): key is string => typeof key === 'string' && key.length > 0),
  );

  return LEGACY_LIFE_CARD_DEMO_ITEMS.filter(
    (item) => !item.capability_key || !existingCapabilities.has(item.capability_key),
  ).map((item) => ({ ...item }));
}
