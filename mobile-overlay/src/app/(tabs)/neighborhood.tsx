import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { NeighborhoodScreen } from '../../features/neighborhood/NeighborhoodScreen';

export default function NeighborhoodRoute() {
  return (
    <View style={{ flex: 1 }}>
      <NeighborhoodScreen />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Administrar o agregar mi negocio"
        onPress={() => router.push('/business/register')}
        style={{
          position: 'absolute',
          right: 18,
          bottom: 22,
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 11,
          backgroundColor: 'white',
        }}
      >
        <Text style={{ fontWeight: '700' }}>Mi negocio</Text>
      </Pressable>
    </View>
  );
}
