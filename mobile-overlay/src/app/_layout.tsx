import { Stack } from 'expo-router';
import { PreviewBuildWatcher } from '../components/dev/PreviewBuildWatcher';
import { AuthGate } from '../features/auth/AuthGate';
import { AuthRuntimeProvider } from '../providers/AuthRuntimeProvider';
import { MutationSyncBootstrap } from '../providers/MutationSyncBootstrap';
import { PaltaSQLiteProvider } from '../providers/PaltaSQLiteProvider';
import { NeighborhoodStateProvider } from '../state/NeighborhoodStateProvider';

export default function RootLayout() {
  return (
    <AuthRuntimeProvider>
      <AuthGate>
        <PaltaSQLiteProvider>
          <MutationSyncBootstrap />
          <PreviewBuildWatcher />
          <NeighborhoodStateProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </NeighborhoodStateProvider>
        </PaltaSQLiteProvider>
      </AuthGate>
    </AuthRuntimeProvider>
  );
}
