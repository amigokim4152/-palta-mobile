import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

export type ReferenceMode = 'normal' | 'large' | 'accessibility';

export const fontScaleByReferenceMode: Record<ReferenceMode, number> = {
  normal: 1,
  large: 1.35,
  accessibility: 1.9,
};

export function ReferenceModeSwitcher({
  mode,
  onChange,
}: {
  mode: ReferenceMode;
  onChange: (mode: ReferenceMode) => void;
}) {
  return (
    <View
      style={{
        flexDirection: mode === 'accessibility' ? 'column' : 'row',
        gap: 8,
      }}
    >
      {(['normal', 'large', 'accessibility'] as const).map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === item }}
          onPress={() => onChange(item)}
          style={{
            minHeight: paltaTheme.touch.minimum,
            paddingHorizontal: 12,
            justifyContent: 'center',
            borderRadius: paltaTheme.radius.pill,
            borderWidth: 1,
            borderColor:
              mode === item
                ? paltaTheme.color.brandPrimary
                : paltaTheme.color.border,
            backgroundColor:
              mode === item
                ? paltaTheme.color.brandSoft
                : paltaTheme.color.surface,
          }}
        >
          <Text
            allowFontScaling={false}
            style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
