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
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: paltaTheme.radius.prominent,
        borderWidth: 1,
        borderColor: paltaTheme.color.border,
        backgroundColor: paltaTheme.color.surface,
        padding: 14,
      }}
    >
      {eyebrow ? (
        <Text
          allowFontScaling
          style={{
            fontSize: 11,
            lineHeight: 15,
            fontWeight: '800',
            color: paltaTheme.color.brandPrimary,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}

      <Text
        allowFontScaling
        style={{
          marginTop: eyebrow ? 4 : 0,
          fontSize: 19,
          lineHeight: 25,
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
            marginTop: 4,
            fontSize: 14,
            lineHeight: 20,
            color: paltaTheme.color.textSecondary,
          }}
        >
          {body}
        </Text>
      ) : null}

      {actionLabel ? (
        <Pressable
          accessibilityRole={onPress ? 'button' : undefined}
          disabled={!onPress}
          onPress={onPress}
          style={{
            minHeight: paltaTheme.touch.minimum,
            alignSelf: 'flex-start',
            justifyContent: 'center',
            marginTop: 8,
          }}
        >
          <Text
            allowFontScaling
            style={{
              color: paltaTheme.color.brandPrimary,
              fontWeight: '800',
              fontSize: 15,
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
