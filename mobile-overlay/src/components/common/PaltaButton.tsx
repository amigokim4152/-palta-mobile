import type { PropsWithChildren } from 'react';
import {
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

type Variant = 'primary' | 'secondary' | 'quiet' | 'critical';

type Props = PropsWithChildren<{
  label: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}>;

function variantColors(variant: Variant, pressed: boolean) {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: pressed
          ? paltaTheme.color.brandMid
          : paltaTheme.color.brandPrimary,
        borderColor: pressed
          ? paltaTheme.color.brandMid
          : paltaTheme.color.brandPrimary,
        textColor: paltaTheme.color.surface,
      };
    case 'critical':
      return {
        backgroundColor: pressed
          ? paltaTheme.color.surfaceMuted
          : paltaTheme.color.surface,
        borderColor: paltaTheme.color.danger,
        textColor: paltaTheme.color.danger,
      };
    case 'quiet':
      return {
        backgroundColor: pressed
          ? paltaTheme.color.surfaceMuted
          : 'transparent',
        borderColor: 'transparent',
        textColor: paltaTheme.color.textSecondary,
      };
    case 'secondary':
    default:
      return {
        backgroundColor: pressed
          ? paltaTheme.color.surfaceMuted
          : paltaTheme.color.surface,
        borderColor: paltaTheme.color.border,
        textColor: paltaTheme.color.textPrimary,
      };
  }
}

export function PaltaButton({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
  style,
}: Props) {
  const blocked = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => {
        const colors = variantColors(variant, pressed);
        return [
          {
            minHeight: paltaTheme.touch.minimum,
            paddingHorizontal: paltaTheme.spacing.md,
            paddingVertical: paltaTheme.spacing.sm,
            borderRadius: paltaTheme.radius.control,
            borderWidth: variant === 'quiet' ? 0 : 1,
            borderColor: colors.borderColor,
            backgroundColor: colors.backgroundColor,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: blocked ? 0.45 : 1,
          },
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const colors = variantColors(variant, pressed);
        return (
          <Text
            allowFontScaling
            numberOfLines={1}
            style={{
              fontSize: 15,
              fontWeight: variant === 'quiet' ? '700' : '800',
              color: colors.textColor,
            }}
          >
            {loading ? '…' : label}
          </Text>
        );
      }}
    </Pressable>
  );
}
