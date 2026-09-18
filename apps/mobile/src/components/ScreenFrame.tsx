import type { PropsWithChildren, ReactNode } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  scroll?: boolean;
}>;

export function ScreenFrame({ title, subtitle, action, scroll = true, children }: Props) {
  const content = (
    <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: "700" }}>{title}</Text>
          {subtitle ? <Text style={{ marginTop: 4, opacity: 0.68 }}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      <View style={{ flex: 1, marginTop: 18 }}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}
