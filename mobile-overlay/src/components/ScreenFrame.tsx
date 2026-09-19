import type { PropsWithChildren, ReactNode } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { paltaTheme } from "../theme/paltaTheme";

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  scroll?: boolean;
}>;

export function ScreenFrame({ title, subtitle, action, scroll = true, children }: Props) {
  const content = (
    <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 10, backgroundColor: paltaTheme.color.canvas }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text allowFontScaling style={{ fontSize: 26, fontWeight: "700", color: paltaTheme.color.textPrimary }}>{title}</Text>
          {subtitle ? <Text allowFontScaling style={{ marginTop: 4, color: paltaTheme.color.textSecondary }}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      <View style={{ flex: 1, marginTop: 18 }}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}
