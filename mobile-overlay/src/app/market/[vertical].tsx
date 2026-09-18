import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import {
  marketVerticalByKey,
  type MarketVerticalKey,
} from '../../../../src/market/marketVerticalPolicy';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';

/** Display copy stays in the UI/localization layer, never canonical policy. */
const FALLBACK_VERTICAL_TITLES: Record<MarketVerticalKey, string> = {
  secondhand: 'Usados',
  vehicles: 'Vehículos',
  property: 'Propiedades',
  local_produce: 'Productos locales',
};

export default function MarketVerticalScreen() {
  const { vertical, mode } = useLocalSearchParams<{
    vertical: MarketVerticalKey;
    mode?: string;
  }>();

  let definition;
  try {
    definition = marketVerticalByKey(vertical);
  } catch {
    return (
      <ScreenFrame title="Mercado">
        <Text>Categoría no válida.</Text>
      </ScreenFrame>
    );
  }

  const createMode = mode === 'create';
  const title = FALLBACK_VERTICAL_TITLES[definition.key];

  return (
    <ScreenFrame
      title={title}
      subtitle={createMode ? 'Publicar' : 'Explorar'}
    >
      <View style={{ gap: 16 }}>
        <SectionHeading
          title={createMode ? `Publicar en ${title}` : `Explorar ${title}`}
          subtitle={
            createMode
              ? 'Cada tipo de publicación usa un formulario específico; no existe un “publicar” genérico.'
              : definition.mapUseful
                ? 'Lista y mapa comparten los mismos listings; el mapa usa Map Core.'
                : 'Esta categoría prioriza lista y búsqueda y puede abrir mapa cuando aporte valor.'
          }
        />
        <Text style={{ opacity: 0.62 }}>
          La entrada ya usa la política común de Mercado. Los formularios específicos se
          conectan por vertical sin duplicar Business, Map, Messaging ni Care.
        </Text>
      </View>
    </ScreenFrame>
  );
}
