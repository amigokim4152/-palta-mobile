import { Text } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';

export default function SearchScreen() {
  return (
    <ScreenFrame title="Buscar" subtitle="Una búsqueda, múltiples tipos de resultado">
      <Text>Places · Businesses · Public actions · Events · Market · Personal state when appropriate</Text>
    </ScreenFrame>
  );
}
