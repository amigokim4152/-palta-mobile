import { Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  meta: string;
  distance?: string;
  onPress?: () => void;
};

export function LocalResultCard({ name, meta, distance, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 14, borderBottomWidth: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "600" }}>{name}</Text>
          <Text style={{ marginTop: 4, opacity: 0.68 }}>{meta}</Text>
        </View>
        {distance ? <Text style={{ opacity: 0.6 }}>{distance}</Text> : null}
      </View>
    </Pressable>
  );
}
