import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import {
  marketVerticalByKey,
  type MarketVerticalKey,
} from '../../../../src/market/marketVerticalPolicy';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';

const FALLBACK_VERTICAL_TITLES: Record<MarketVerticalKey, string> = {
  secondhand: 'Usados',
  vehicles: 'Vehículos',
  property: 'Propiedades',
  jobs_services: 'Empleos y servicios',
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
          title={
            createMode
              ? `Publicar en ${title}`
              : `Explorar ${title}`
          }
          subtitle={
            createMode
              ? 'El formulario será específico de esta categoría; no existe un “publicar” genérico.'
              : definition.mapUseful
                ? 'Esta categoría puede usar el Map Core sin crear otro mapa.'
                : 'Esta categoría prioriza lista y búsqueda.'
          }
        />
        <Text style={{ opacity: 0.62 }}>
          El contrato de datos del vertical todavía no está conectado. Esta pantalla
          define la entrada correcta sin inventar publicaciones.
        </Text>
      </View>
    </ScreenFrame>
  );
}
