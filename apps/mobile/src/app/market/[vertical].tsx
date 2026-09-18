import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import {
  marketVerticalByKey,
  type MarketVerticalKey,
} from '../../../../../src/market/marketVerticalPolicy';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';

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

  return (
    <ScreenFrame
      title={definition.title}
      subtitle={createMode ? 'Publicar' : 'Explorar'}
    >
      <View style={{ gap: 16 }}>
        <SectionHeading
          title={
            createMode
              ? `Publicar en ${definition.title}`
              : `Explorar ${definition.title}`
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
