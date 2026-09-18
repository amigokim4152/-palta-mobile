import { Stack } from 'expo-router';
import { PreviewBuildWatcher } from '../components/dev/PreviewBuildWatcher';
import { AuthGate } from '../features/auth/AuthGate';
import { AuthRuntimeProvider } from '../providers/AuthRuntimeProvider';
import { LocalizationProvider } from '../providers/LocalizationProvider';
import { MarketRuntimeBootstrap } from '../providers/MarketRuntimeBootstrap';
import { MutationSyncBootstrap } from '../providers/MutationSyncBootstrap';
import { PaltaSQLiteProvider } from '../providers/PaltaSQLiteProvider';
import { NeighborhoodStateProvider } from '../state/NeighborhoodStateProvider';

function RuntimeShell() {
  return (
    <PaltaSQLiteProvider>
      <MutationSyncBootstrap />
      <MarketRuntimeBootstrap />
      <PreviewBuildWatcher />
      <NeighborhoodStateProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NeighborhoodStateProvider>
    </PaltaSQLiteProvider>
  );
}

export default function RootLayout() {
  const preview = process.env.EXPO_PUBLIC_PALTA_PREVIEW === '1';

  return (
    <AuthRuntimeProvider>
      <LocalizationProvider>
        {preview ? (
          <RuntimeShell />
        ) : (
          <AuthGate>
            <RuntimeShell />
          </AuthGate>
        )}
      </LocalizationProvider>
    </AuthRuntimeProvider>
  );
}
