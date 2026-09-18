import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

const ACTIONS = [
  { key: 'saved', label: 'Guardados', route: '/propiedades/saved' },
  { key: 'mine', label: 'Mis propiedades', route: '/propiedades/mine' },
  { key: 'create', label: 'Publicar', route: '/propiedades/create' },
] as const;

export function RealEstateAccountActions() {
  return (
    <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
      {ACTIONS.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          onPress={() => router.push(action.route)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 8,
            borderRadius: paltaTheme.radius.control,
            borderWidth: 1,
            borderColor: paltaTheme.color.divider,
            backgroundColor: pressed ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
          })}
        >
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: action.key === 'create' ? paltaTheme.color.brandPrimary : paltaTheme.color.textSecondary }}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
