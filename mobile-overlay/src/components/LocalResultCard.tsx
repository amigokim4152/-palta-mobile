import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../theme/paltaTheme';

type Props = {
  name: string;
  meta: string;
  distance?: string;
  selected?: boolean;
  onPress?: () => void;
};

export function LocalResultCard({
  name,
  meta,
  distance,
  selected = false,
  onPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: paltaTheme.touch.minimum,
        paddingHorizontal: selected ? paltaTheme.spacing.sm : 0,
        paddingVertical: paltaTheme.spacing.sm,
        borderBottomWidth: selected ? 0 : 1,
        borderWidth: selected ? 1 : 0,
        borderColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
        borderRadius: selected ? paltaTheme.radius.surface : 0,
        backgroundColor: selected
          ? paltaTheme.color.brandSoft
          : pressed
            ? paltaTheme.color.surfaceMuted
            : paltaTheme.color.surface,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: paltaTheme.color.textPrimary,
            }}
          >
            {name}
          </Text>
          {meta ? (
            <Text
              numberOfLines={2}
              style={{
                marginTop: paltaTheme.spacing.xxs,
                color: paltaTheme.color.textSecondary,
                lineHeight: 19,
              }}
            >
              {meta}
            </Text>
          ) : null}
        </View>
        {distance ? (
          <Text
            style={{
              color: paltaTheme.color.textMuted,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {distance}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
