import { Pressable, Text, View } from "react-native";

export type HomeCandidateCardProps = {
  eyebrow: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onPress?: () => void;
};

export function HomeCandidateCard({
  eyebrow,
  title,
  body,
  actionLabel,
  onPress
}: HomeCandidateCardProps) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ paddingVertical: 16, borderBottomWidth: 1 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", opacity: 0.6 }}>{eyebrow}</Text>
      <Text style={{ marginTop: 6, fontSize: 19, fontWeight: "600" }}>{title}</Text>
      {body ? <Text style={{ marginTop: 6, lineHeight: 20, opacity: 0.8 }}>{body}</Text> : null}
      {actionLabel ? <Text style={{ marginTop: 10, fontWeight: "700" }}>{actionLabel}</Text> : null}
    </Pressable>
  );
}
