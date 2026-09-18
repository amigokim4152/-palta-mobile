import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../theme/paltaTheme';

export type HomeCandidateCardProps = {
  eyebrow: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onPress?: () => void;
};

export function HomeCandidateCard({ eyebrow, title, body, actionLabel, onPress }: HomeCandidateCardProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        minHeight: paltaTheme.touch.minimum,
        paddingVertical: paltaTheme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: paltaTheme.color.divider,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.xs }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: paltaTheme.radius.pill,
            backgroundColor: paltaTheme.color.brandFresh,
          }}
        />
        <Text allowFontScaling style={{ color: paltaTheme.color.textMuted, fontSize: 12, fontWeight: '700' }}>
          {eyebrow}
        </Text>
      </View>
      <Text
        allowFontScaling
        style={{ marginTop: 7, color: paltaTheme.color.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '700' }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          allowFontScaling
          style={{ marginTop: 5, color: paltaTheme.color.textSecondary, fontSize: 15, lineHeight: 21 }}
        >
          {body}
        </Text>
      ) : null}
      {actionLabel ? (
        <Text
          allowFontScaling
          style={{ marginTop: paltaTheme.spacing.sm, color: paltaTheme.color.brandPrimary, fontSize: 14, fontWeight: '700' }}
        >
          {actionLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}
