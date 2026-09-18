import { Text, View } from 'react-native';

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View accessibilityRole="header" style={{ gap: 4 }}>
      {eyebrow ? (
        <Text
          allowFontScaling
          style={{ fontSize: 12, fontWeight: '700', opacity: 0.58 }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text allowFontScaling style={{ fontSize: 20, fontWeight: '700' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text allowFontScaling style={{ fontSize: 14, opacity: 0.64 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
