import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import {
  MarketVerticalBrowseScreen,
  type MarketRouteVertical,
} from '../../features/market/MarketVerticalBrowseScreen';

type MarketRouteDefinition = {
  title: string;
};

/**
 * Route/display copy is intentionally UI-local so the canonical Mercado policy
 * stays language-neutral. This table also keeps the live overlay compatible
 * with the reviewed 8b955c4 contract until the new canonical policy is promoted.
 */
const MARKET_ROUTE_UI: Record<MarketRouteVertical, MarketRouteDefinition> = {
  secondhand: { title: 'Usados' },
  vehicles: { title: 'Vehículos' },
  property: { title: 'Propiedades' },
  local_produce: { title: 'Productos locales' },
};

function routeVertical(value: string | undefined): MarketRouteVertical | undefined {
  if (!value || !(value in MARKET_ROUTE_UI)) return undefined;
  return value as MarketRouteVertical;
}

export default function MarketVerticalScreen() {
  const { vertical, mode } = useLocalSearchParams<{
    vertical?: string;
    mode?: string;
  }>();
  const resolvedVertical = routeVertical(vertical);

  if (!resolvedVertical) {
    return (
      <ScreenFrame title="Mercado">
        <Text>Categoría no válida.</Text>
      </ScreenFrame>
    );
  }

  if (mode !== 'create') {
    return <MarketVerticalBrowseScreen vertical={resolvedVertical} />;
  }

  const definition = MARKET_ROUTE_UI[resolvedVertical];
  return (
    <ScreenFrame title={definition.title} subtitle="Publicar">
      <View style={{ gap: 16 }}>
        <SectionHeading
          title={`Publicar en ${definition.title}`}
          subtitle="Cada tipo de publicación usa un formulario específico; no existe un publicar genérico."
        />
        <Text style={{ opacity: 0.62 }}>
          Esta entrada conserva el vertical seleccionado. El formulario específico se conecta sin duplicar Business, Map, Messaging ni Care.
        </Text>
      </View>
    </ScreenFrame>
  );
}
