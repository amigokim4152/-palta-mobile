import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

export type OwnerPartnerCardTone = 'normal' | 'attention' | 'success' | 'optional';

export function OwnerPartnerCard({
  eyebrow,
  title,
  body,
  badge,
  tone = 'normal',
  onPress,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  badge?: string;
  tone?: OwnerPartnerCardTone;
  onPress?: () => void;
}) {
  const backgroundColor =
    tone === 'attention'
      ? paltaTheme.color.avocadoCream
      : tone === 'success'
        ? paltaTheme.color.brandSoft
        : paltaTheme.color.surface;
  const borderColor =
    tone === 'attention' || tone === 'success'
      ? paltaTheme.color.brandPrimary
      : paltaTheme.color.border;

  const content = (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: paltaTheme.spacing.xs,
        }}
      >
        {eyebrow ? (
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: '800',
              color: paltaTheme.color.textMuted,
            }}
          >
            {eyebrow.toUpperCase()}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {badge ? (
          <View
            style={{
              borderRadius: paltaTheme.radius.pill,
              paddingHorizontal: paltaTheme.spacing.xs,
              paddingVertical: paltaTheme.spacing.xxs,
              backgroundColor:
                tone === 'attention'
                  ? paltaTheme.color.surface
                  : paltaTheme.color.surfaceMuted,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: paltaTheme.color.textSecondary,
              }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{
          fontSize: 17,
          lineHeight: 22,
          fontWeight: '800',
          color: paltaTheme.color.textPrimary,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          lineHeight: 20,
          color: paltaTheme.color.textSecondary,
        }}
      >
        {body}
      </Text>
      {onPress ? (
        <Text
          style={{
            marginTop: paltaTheme.spacing.xxs,
            fontSize: 13,
            fontWeight: '800',
            color: paltaTheme.color.brandPrimary,
          }}
        >
          Ver y gestionar →
        </Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor,
          borderRadius: paltaTheme.radius.surface,
          padding: paltaTheme.spacing.sm,
          gap: paltaTheme.spacing.xxs,
          backgroundColor: pressed ? paltaTheme.color.surfaceMuted : backgroundColor,
        })}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor,
        borderRadius: paltaTheme.radius.surface,
        padding: paltaTheme.spacing.sm,
        gap: paltaTheme.spacing.xxs,
        backgroundColor,
      }}
    >
      {content}
    </View>
  );
}
