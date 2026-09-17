import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { NeighborhoodScreen } from '../../features/neighborhood/NeighborhoodScreen';

function FloatingAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 11,
        backgroundColor: 'white',
      }}
    >
      <Text style={{ fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default function NeighborhoodRoute() {
  return (
    <View style={{ flex: 1 }}>
      <NeighborhoodScreen />
      <View
        style={{
          position: 'absolute',
          right: 18,
          bottom: 22,
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <FloatingAction
          label="Negocios cerca"
          onPress={() => router.push('/local-businesses')}
        />
        <FloatingAction
          label="Mi negocio"
          onPress={() => router.push('/business/register')}
        />
      </View>
    </View>
  );
}
