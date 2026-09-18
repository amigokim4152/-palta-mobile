import type { PropsWithChildren } from 'react';
import {
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ui } from '../../theme/semanticUi';

type Props = PropsWithChildren<{
  label: string;
  variant?: 'primary' | 'secondary' | 'quiet' | 'critical';
  loading?: boolean;
  disabled?: boolean;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}>;

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
      style={[
        {
          minHeight: ui.touch.minimum,
          paddingHorizontal: ui.spacing.lg,
          paddingVertical: ui.spacing.md,
          borderRadius: ui.radius.md,
          borderWidth: variant === 'quiet' ? 0 : 1,
          justifyContent: 'center',
          opacity: blocked ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Text
        allowFontScaling
        style={{
          fontSize: 16,
          fontWeight: variant === 'quiet' ? '600' : '700',
        }}
      >
        {loading ? '…' : label}
      </Text>
    </Pressable>
  );
}
