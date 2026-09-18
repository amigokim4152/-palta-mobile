import { Pressable, Text, View } from 'react-native';
import { surfaceT } from '../../../src/localization/index';
import { useLocalization } from '../providers/LocalizationProvider';

export function LoadingState({ label }: { label?: string }) {
  const { locale } = useLocalization();

  return (
    <View style={{ paddingVertical: 18 }}>
      <Text style={{ opacity: 0.65 }}>
        {label ?? surfaceT('async.loading', locale)}
      </Text>
    </View>
  );
}

export function ErrorState({
  safeMessage,
  onRetry,
}: {
  safeMessage?: string;
  onRetry?: () => void;
}) {
  const { locale } = useLocalization();

  return (
    <View style={{ paddingVertical: 18, gap: 10 }}>
      <Text style={{ fontWeight: '700' }}>
        {surfaceT('async.errorTitle', locale)}
      </Text>
      <Text style={{ opacity: 0.65 }}>
        {safeMessage ?? surfaceT('async.errorBody', locale)}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '700' }}>
            {surfaceT('async.retry', locale)}
          </Text>
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
