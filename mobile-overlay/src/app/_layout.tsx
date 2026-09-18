import { Stack } from 'expo-router';
import { PreviewBuildWatcher } from '../components/dev/PreviewBuildWatcher';
import { AuthGate } from '../features/auth/AuthGate';
import { AuthRuntimeProvider } from '../providers/AuthRuntimeProvider';
import { MarketRuntimeBootstrap } from '../providers/MarketRuntimeBootstrap';
import { MutationSyncBootstrap } from '../providers/MutationSyncBootstrap';
import { PaltaSQLiteProvider } from '../providers/PaltaSQLiteProvider';
import { NeighborhoodStateProvider } from '../state/NeighborhoodStateProvider';

function PaltaAppRuntime() {
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
  const previewMode =
    __DEV__ && process.env.EXPO_PUBLIC_PALTA_PREVIEW === '1';

  if (previewMode) {
    return <PaltaAppRuntime />;
  }

  return (
    <AuthRuntimeProvider>
      <AuthGate>
        <PaltaAppRuntime />
      </AuthGate>
    </AuthRuntimeProvider>
  );
}
