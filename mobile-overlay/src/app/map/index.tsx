import { View } from 'react-native';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import { ScreenFrame } from '../../components/ScreenFrame';

const DEFAULT_CHILE_STYLE_URL =
  'https://palta-map-edge.kimeuisin.workers.dev/maps/cl/style.json';

const SANTIAGO_CENTER = {
  latitude: -33.4489,
  longitude: -70.6693,
};

export default function SharedMapScreen() {
  const mapStyle =
    process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? DEFAULT_CHILE_STYLE_URL;

  return (
    <ScreenFrame title="Mapa" subtitle="Chile · Palta Map Core" scroll={false}>
      <View style={{ flex: 1, minHeight: 320 }}>
        <NeighborhoodMap
          mapStyle={mapStyle}
          features={[]}
          initialCenter={SANTIAGO_CENTER}
          initialZoom={10}
        />
      </View>
    </ScreenFrame>
  );
}
