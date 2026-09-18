import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';

type MarketRouteVertical =
  | 'secondhand'
  | 'vehicles'
  | 'property'
  | 'local_produce';

type MarketRouteDefinition = {
  title: string;
  mapUseful: boolean;
};

/**
 * Route/display copy is intentionally UI-local so the canonical Mercado policy
 * stays language-neutral. This table also keeps the live overlay compatible
 * with the reviewed 8b955c4 contract until the new canonical policy is promoted.
 */
const MARKET_ROUTE_UI: Record<MarketRouteVertical, MarketRouteDefinition> = {
  secondhand: { title: 'Usados', mapUseful: false },
  vehicles: { title: 'Vehículos', mapUseful: true },
  property: { title: 'Propiedades', mapUseful: true },
  local_produce: { title: 'Productos locales', mapUseful: true },
};

function routeDefinition(value: string | undefined): MarketRouteDefinition | undefined {
  if (!value || !(value in MARKET_ROUTE_UI)) return undefined;
  return MARKET_ROUTE_UI[value as MarketRouteVertical];
}

export default function MarketVerticalScreen() {
  const { vertical, mode } = useLocalSearchParams<{
    vertical?: string;
    mode?: string;
  }>();
  const definition = routeDefinition(vertical);

  if (!definition) {
    return (
      <ScreenFrame title="Mercado">
        <Text>Categoría no válida.</Text>
      </ScreenFrame>
    );
  }

  const createMode = mode === 'create';

  return (
    <ScreenFrame
      title={definition.title}
      subtitle={createMode ? 'Publicar' : 'Explorar'}
    >
      <View style={{ gap: 16 }}>
        <SectionHeading
          title={createMode ? `Publicar en ${definition.title}` : `Explorar ${definition.title}`}
          subtitle={
            createMode
              ? 'Cada tipo de publicación usa un formulario específico; no existe un “publicar” genérico.'
              : definition.mapUseful
                ? 'Lista y mapa comparten los mismos listings; el mapa usa Map Core.'
                : 'Esta categoría prioriza lista y búsqueda y puede abrir mapa cuando aporte valor.'
          }
        />
        <Text style={{ opacity: 0.62 }}>
          La entrada usa la política común de Mercado. Los formularios específicos se
          conectan por vertical sin duplicar Business, Map, Messaging ni Care.
        </Text>
      </View>
    </ScreenFrame>
  );
}
