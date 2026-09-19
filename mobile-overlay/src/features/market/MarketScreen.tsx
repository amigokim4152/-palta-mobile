import { router } from 'expo-router';
import { View } from 'react-native';
import { marketVerticals } from '../../../../src/market/marketVerticalPolicy';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { PaltaButton } from '../../components/common/PaltaButton';

const MARKET_VERTICAL_TITLES: Record<
  (typeof marketVerticals)[number]['key'],
  string
> = {
  secondhand: 'Usados',
  vehicles: 'Autos',
  property: 'Propiedades',
  local_produce: 'Productos locales',
};

export function MarketScreen() {
  return (
    <ScreenFrame
      title="Mercado"
      subtitle="Explorar primero. Publicar dentro de cada categoría."
    >
      <View style={{ gap: 20 }}>
        {marketVerticals.map((vertical) => (
          <View key={vertical.key} style={{ gap: 10 }}>
            <SectionHeading
              title={MARKET_VERTICAL_TITLES[vertical.key]}
              subtitle={
                vertical.mapUseful
                  ? 'Lista y mapa cuando la ubicación realmente ayuda.'
                  : 'Lista simple: el mapa no se fuerza si no aporta.'
              }
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PaltaButton
                label="Explorar"
                variant="primary"
                onPress={() =>
                  router.push(`/market/${vertical.key}`)
                }
              />
              <PaltaButton
                label="Publicar"
                variant="secondary"
                onPress={() =>
                  router.push(
                    `/market/${vertical.key}?mode=create`,
                  )
                }
              />
            </View>
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}
