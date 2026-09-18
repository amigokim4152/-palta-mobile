import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

/**
 * Cross-vertical entry surface owned by Negocios. The destination vertical
 * keeps ownership of its own inventory and state.
 */
export function BusinessVerticalHandoffBar() {
  return (
    <View
      style={{
        paddingHorizontal: paltaTheme.spacing.sm,
        paddingTop: paltaTheme.spacing.xs,
        paddingBottom: paltaTheme.spacing.xs,
        backgroundColor: paltaTheme.color.canvas,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir Propiedades"
        onPress={() => router.push('/propiedades?source=negocios_category')}
        style={({ pressed }) => ({
          minHeight: 58,
          flexDirection: 'row',
          alignItems: 'center',
          gap: paltaTheme.spacing.sm,
          paddingHorizontal: paltaTheme.spacing.md,
          borderRadius: paltaTheme.radius.prominent,
          borderWidth: 1,
          borderColor: paltaTheme.color.divider,
          backgroundColor: pressed ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
        })}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: paltaTheme.color.brandSoft,
          }}
        >
          <Text style={{ fontSize: 18 }}>⌂</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Propiedades</Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>
            Comprar, arrendar y explorar por mapa
          </Text>
        </View>
        <Text style={{ fontSize: 22, color: paltaTheme.color.textMuted }}>›</Text>
      </Pressable>
    </View>
  );
}
