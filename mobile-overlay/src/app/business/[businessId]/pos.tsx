import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { POSRegisterScreen } from '../../../features/business/POSRegisterScreen';

export default function BusinessPOSRoute() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();

  if (!businessId) {
    return (
      <ScreenFrame title="POS">
        <Text>No se pudo identificar el comercio.</Text>
      </ScreenFrame>
    );
  }

  return <POSRegisterScreen businessId={businessId} />;
}
