import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

export function SummaryListRow({
  title,
  meta,
  detail,
  explicitActionLabel,
  onPress,
  stackMeta = false,
}: {
  title: string;
  meta?: string;
  detail?: string;
  explicitActionLabel?: string;
  onPress?: () => void;
  stackMeta?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={{
        minHeight: paltaTheme.touch.minimum,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: paltaTheme.color.divider,
      }}
    >
      <View
        style={{
          flexDirection: stackMeta ? 'column' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text
          allowFontScaling
          style={{
            flexShrink: 1,
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '650',
            color: paltaTheme.color.textPrimary,
          }}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            allowFontScaling
            style={{
              flexShrink: 0,
              fontSize: 13,
              lineHeight: 19,
              color: paltaTheme.color.textSecondary,
            }}
          >
            {meta}
          </Text>
        ) : null}
      </View>

      {detail ? (
        <Text
          allowFontScaling
          style={{
            marginTop: 3,
            fontSize: 13,
            lineHeight: 18,
            color: paltaTheme.color.textSecondary,
          }}
        >
          {detail}
        </Text>
      ) : null}

      {explicitActionLabel ? (
        <Text
          allowFontScaling
          style={{
            marginTop: 6,
            fontWeight: '700',
            color: paltaTheme.color.brandPrimary,
          }}
        >
          {explicitActionLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}
