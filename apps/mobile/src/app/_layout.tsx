import { Stack } from 'expo-router';
import { MutationSyncBootstrap } from '../providers/MutationSyncBootstrap';
import { PaltaSQLiteProvider } from '../providers/PaltaSQLiteProvider';
import { NeighborhoodStateProvider } from '../state/NeighborhoodStateProvider';

export default function RootLayout() {
  return (
    <PaltaSQLiteProvider>
      <MutationSyncBootstrap />
      <NeighborhoodStateProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NeighborhoodStateProvider>
    </PaltaSQLiteProvider>
  );
}
