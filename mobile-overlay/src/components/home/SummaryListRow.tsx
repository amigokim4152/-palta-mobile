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
        paddingVertical: 13,
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
            fontSize: 17,
            lineHeight: 23,
            fontWeight: '600',
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
              fontSize: 14,
              lineHeight: 21,
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
            marginTop: 4,
            fontSize: 14,
            lineHeight: 20,
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
            marginTop: 8,
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
