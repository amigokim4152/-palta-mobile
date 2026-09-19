import { Redirect, router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { AuthGate } from '../../features/auth/AuthGate';
import { useAuthRuntime } from '../../providers/AuthRuntimeProvider';
import { useLocalization } from '../../providers/LocalizationProvider';
import { resolveAppEntryPolicy } from '../../../../src/runtime/appEntryPolicy';

function SignedInQaStatus() {
  const { state } = useAuthRuntime();
  const { t } = useLocalization();
  return (
    <ScreenFrame title="Auth QA" action={
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text>{t('common.back')}</Text>
      </Pressable>
    }>
      <Text>{state.status === 'signed_in' ? `Palta ID: ${state.session.paltaUserId}` : ''}</Text>
    </ScreenFrame>
  );
}

export default function AuthQaScreen() {
  const entryPolicy = resolveAppEntryPolicy({
    environment: process.env.EXPO_PUBLIC_ENV,
    preview: process.env.EXPO_PUBLIC_PALTA_PREVIEW,
    entryMode: process.env.EXPO_PUBLIC_PALTA_ENTRY_MODE,
    developmentBuild: __DEV__,
  });
  if (entryPolicy !== 'app') return <Redirect href="/(tabs)/home" />;
  return <AuthGate qaMode><SignedInQaStatus /></AuthGate>;
}
