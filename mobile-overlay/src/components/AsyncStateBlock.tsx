import { Pressable, Text, View } from 'react-native';

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 18 }}>
      <Text style={{ opacity: 0.65 }}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={{ paddingVertical: 18, gap: 10 }}>
      <Text style={{ fontWeight: '700' }}>No pudimos actualizar esta información.</Text>
      <Text style={{ opacity: 0.65 }}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '700' }}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <View style={{ paddingVertical: 18 }}>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>{title}</Text>
      {body ? <Text style={{ marginTop: 6, opacity: 0.65 }}>{body}</Text> : null}
    </View>
  );
}
