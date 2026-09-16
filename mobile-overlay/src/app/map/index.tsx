import { Text } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';

export default function SharedMapScreen() {
  return (
    <ScreenFrame title="Mapa" subtitle="Shared Map Core" scroll={false}>
      <Text>Contextual map route. It is not a sixth permanent tab.</Text>
    </ScreenFrame>
  );
}
