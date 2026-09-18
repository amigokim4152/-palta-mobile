import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

type VerticalEntryProps = {
  title: string;
  subtitle: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function VerticalEntry({
  title,
  subtitle,
  accessibilityLabel,
  onPress,
}: VerticalEntryProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 76,
        justifyContent: 'center',
        paddingHorizontal: paltaTheme.spacing.sm,
        paddingVertical: paltaTheme.spacing.xs,
        borderRadius: paltaTheme.radius.prominent,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
        backgroundColor: pressed ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.xxs }}>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '900',
            color: paltaTheme.color.textPrimary,
          }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 20, color: paltaTheme.color.textMuted }}>›</Text>
      </View>
      <Text
        numberOfLines={2}
        style={{
          marginTop: 3,
          fontSize: 12,
          lineHeight: 16,
          color: paltaTheme.color.textMuted,
        }}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

/**
 * Cross-vertical entry surface owned by Negocios. The destination vertical
 * keeps ownership of its own inventory and state.
 *
 * Propiedades and Autos are independent verticals, not local-business
 * category queries. They share the same visual and navigation level here.
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
      <Text
        style={{
          marginBottom: paltaTheme.spacing.xxs,
          fontSize: 12,
          fontWeight: '800',
          color: paltaTheme.color.textMuted,
        }}
      >
        Servicios
      </Text>
      <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
        <VerticalEntry
          title="Propiedades"
          subtitle="Comprar, arrendar y explorar"
          accessibilityLabel="Abrir Propiedades"
          onPress={() => router.push('/propiedades?source=negocios_category')}
        />
        <VerticalEntry
          title="Autos"
          subtitle="Comprar y vender vehículos"
          accessibilityLabel="Abrir Autos"
          onPress={() => router.push('/autos?source=negocios_category')}
        />
      </View>
    </View>
  );
}
