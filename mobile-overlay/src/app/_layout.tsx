import { Stack } from 'expo-router';
import { MutationSyncBootstrap } from '../providers/MutationSyncBootstrap';
import { PaltaSQLiteProvider } from '../providers/PaltaSQLiteProvider';
import { NeighborhoodStateProvider } from '../state/NeighborhoodStateProvider';
import { AuthRuntimeProvider } from '../providers/AuthRuntimeProvider';
import { LocalizationProvider } from '../providers/LocalizationProvider';
import { AuthGate } from '../features/auth/AuthGate';

export default function RootLayout() {
  return (
    <AuthRuntimeProvider>
      <LocalizationProvider>
        <AuthGate>
          <PaltaSQLiteProvider>
            <MutationSyncBootstrap />
            <NeighborhoodStateProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </NeighborhoodStateProvider>
          </PaltaSQLiteProvider>
        </AuthGate>
      </LocalizationProvider>
    </AuthRuntimeProvider>
  );
}
