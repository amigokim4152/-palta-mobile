import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

type Props = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}>;

export function BusinessDiscoveryShell({
  title = 'Negocios',
  subtitle = 'Cerca de ti, cuando realmente lo necesitas',
  leftAction,
  rightAction,
  children,
}: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: paltaTheme.spacing.sm,
          paddingHorizontal: paltaTheme.spacing.md,
          paddingTop: paltaTheme.spacing.xs,
          paddingBottom: paltaTheme.spacing.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 24,
              fontWeight: '800',
              letterSpacing: -0.45,
              color: paltaTheme.color.textPrimary,
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              marginTop: 2,
              fontSize: 12,
              color: paltaTheme.color.textMuted,
            }}
          >
            {subtitle}
          </Text>
        </View>

        {(leftAction || rightAction) ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: paltaTheme.spacing.xxs,
              flexShrink: 0,
            }}
          >
            {leftAction ? <View>{leftAction}</View> : null}
            {rightAction ? <View>{rightAction}</View> : null}
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

export function BusinessHeaderAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        minHeight: paltaTheme.touch.minimum,
        justifyContent: 'center',
        paddingHorizontal: paltaTheme.spacing.xs,
        borderRadius: paltaTheme.radius.control,
        backgroundColor: pressed
          ? paltaTheme.color.surfaceMuted
          : 'transparent',
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '800',
          color: paltaTheme.color.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
