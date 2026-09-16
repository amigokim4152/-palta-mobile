import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';

export default function ContextScreen() {
  const { contextId } = useLocalSearchParams<{ contextId: string }>();
  return (
    <ScreenFrame title="Contexto" subtitle={`Temporary context · ${contextId ?? ''}`}>
      <Text>
        Temporary life/travel context reuses canonical entities and Care state; it is not a new silo.
      </Text>
    </ScreenFrame>
  );
}
