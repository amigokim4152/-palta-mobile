import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BusinessDiscoveryExperience } from '../../features/business/BusinessDiscoveryExperience';
import { paltaTheme } from '../../theme/paltaTheme';

/**
 * Primary Local Business surface.
 *
 * The default experience remains the all-business map/list. Specialized
 * consumer intents such as food ordering enter from the top layer without
 * replacing or filtering away the canonical neighborhood business surface.
 */
export default function BusinessesTab() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <BusinessDiscoveryExperience />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir comida y pedidos"
        onPress={() => router.push('/local-businesses/food')}
        style={({ pressed }) => ({
          position: 'absolute',
          top: insets.top + 112,
          left: paltaTheme.spacing.sm,
          zIndex: 30,
          minHeight: 34,
          justifyContent: 'center',
          paddingHorizontal: paltaTheme.spacing.sm,
          borderRadius: paltaTheme.radius.pill,
          borderWidth: 1,
          borderColor: paltaTheme.color.brandPrimary,
          backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
        })}
      >
        <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.surface }}>
          Comida
        </Text>
      </Pressable>
    </View>
  );
}
