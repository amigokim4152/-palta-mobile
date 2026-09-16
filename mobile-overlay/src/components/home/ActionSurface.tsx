import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

export function ActionSurface({
  eyebrow,
  title,
  body,
  actionLabel,
  onPress,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  actionLabel: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: paltaTheme.radius.prominent,
        borderWidth: 1,
        borderColor: paltaTheme.color.border,
        backgroundColor: paltaTheme.color.surface,
        padding: paltaTheme.spacing.md,
      }}
    >
      {eyebrow ? (
        <Text
          allowFontScaling
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: paltaTheme.color.brandPrimary,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}

      <Text
        allowFontScaling
        style={{
          marginTop: eyebrow ? 6 : 0,
          fontSize: 21,
          lineHeight: 28,
          fontWeight: '700',
          color: paltaTheme.color.textPrimary,
        }}
      >
        {title}
      </Text>

      {body ? (
        <Text
          allowFontScaling
          style={{
            marginTop: 6,
            fontSize: 15,
            lineHeight: 22,
            color: paltaTheme.color.textSecondary,
          }}
        >
          {body}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={{
          minHeight: paltaTheme.touch.minimum,
          alignSelf: 'flex-start',
          justifyContent: 'center',
          marginTop: 10,
        }}
      >
        <Text
          allowFontScaling
          style={{
            color: paltaTheme.color.brandPrimary,
            fontWeight: '800',
            fontSize: 16,
          }}
        >
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
