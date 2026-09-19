import { router } from 'expo-router';
import { View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { PaltaButton } from '../../components/common/PaltaButton';

export function ReferenceIndexScreen() {
  return (
    <ScreenFrame
      title="Palta Reference"
      subtitle="UI/UX inspection routes"
    >
      <View style={{ gap: 12 }}>
        <PaltaButton
          label="Home"
          onPress={() => router.push('/reference/home')}
        />
        <PaltaButton
          label="Barrio"
          variant="secondary"
          onPress={() => router.push('/reference/neighborhood')}
        />
        <PaltaButton
          label="Negocio"
          variant="secondary"
          onPress={() => router.push('/reference/business')}
        />
        <PaltaButton
          label="Care"
          variant="secondary"
          onPress={() => router.push('/reference/care')}
        />
        <PaltaButton
          label="Reading"
          variant="secondary"
          onPress={() => router.push('/reference/reading')}
        />
      </View>
    </ScreenFrame>
  );
}
