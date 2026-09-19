import { Stack, router, usePathname } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { PreviewBuildWatcher } from '../components/dev/PreviewBuildWatcher';
import { AuthGate } from '../features/auth/AuthGate';
import { AuthRuntimeProvider } from '../providers/AuthRuntimeProvider';
import { LocalizationProvider } from '../providers/LocalizationProvider';
import { MarketRuntimeBootstrap } from '../providers/MarketRuntimeBootstrap';
import { MutationSyncBootstrap } from '../providers/MutationSyncBootstrap';
import { PaltaSQLiteProvider } from '../providers/PaltaSQLiteProvider';
import { NeighborhoodStateProvider } from '../state/NeighborhoodStateProvider';
import { paltaTheme } from '../theme/paltaTheme';
import { resolveAppEntryPolicy } from '../../../src/runtime/appEntryPolicy';

function RuntimeShell({ showAuthQaShortcut }: { showAuthQaShortcut: boolean }) {
  const pathname = usePathname();
  const onHome = pathname === '/' || pathname === '/home';
  return (
    <PaltaSQLiteProvider>
      <MutationSyncBootstrap />
      <MarketRuntimeBootstrap />
      <PreviewBuildWatcher />
      <NeighborhoodStateProvider>
        <Stack screenOptions={{ headerShown: false }} />
        {showAuthQaShortcut && onHome ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir Auth QA"
            onPress={() => router.push('/dev/auth')}
            style={{ position: 'absolute', top: 55, right: 18, padding: 8 }}
          >
            <Text style={{ color: paltaTheme.color.brandPrimary, fontWeight: '700' }}>Auth QA</Text>
          </Pressable>
        ) : null}
      </NeighborhoodStateProvider>
    </PaltaSQLiteProvider>
  );
}

export default function RootLayout() {
  const entryPolicy = resolveAppEntryPolicy({
    environment: process.env.EXPO_PUBLIC_ENV,
    preview: process.env.EXPO_PUBLIC_PALTA_PREVIEW,
    entryMode: process.env.EXPO_PUBLIC_PALTA_ENTRY_MODE,
    developmentBuild: __DEV__,
  });

  return (
    <AuthRuntimeProvider>
      <LocalizationProvider>
        {entryPolicy === 'app' ? (
          <RuntimeShell showAuthQaShortcut />
        ) : (
          <AuthGate>
            <RuntimeShell showAuthQaShortcut={false} />
          </AuthGate>
        )}
      </LocalizationProvider>
    </AuthRuntimeProvider>
  );
}
