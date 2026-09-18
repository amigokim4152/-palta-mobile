import type { PropsWithChildren, ReactNode } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { paltaTheme } from '../theme/paltaTheme';

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  scroll?: boolean;
}>;

export function ScreenFrame({ title, subtitle, action, scroll = true, children }: Props) {
  const content = (
    <View style={{ flex: 1, paddingHorizontal: paltaTheme.spacing.lg, paddingTop: paltaTheme.spacing.sm, paddingBottom: paltaTheme.spacing.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text allowFontScaling style={{ color: paltaTheme.color.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text allowFontScaling style={{ marginTop: 2, color: paltaTheme.color.textSecondary, fontSize: 14, lineHeight: 20 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      <View style={{ flex: 1, marginTop: paltaTheme.spacing.xl }}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          style={{ backgroundColor: paltaTheme.color.canvas }}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}
