import type {
  MarketMutationPort,
  MarketReadPort,
} from '../../../../src/market/marketApiContract';
import type { MarketMessagingPort } from '../../../../src/market/marketMessagingFlow';
import type { MarketLocationSummary } from '../../../../src/market/marketPersistenceContract';
import type { MarketSafetyIntent } from '../../../../src/market/marketSafetyIntent';

export type MarketRuntimeMode = 'live' | 'development_preview' | 'unavailable';

export type MarketRuntime = {
  mode: MarketRuntimeMode;
  read?: MarketReadPort;
  mutation?: MarketMutationPort;
  publicArea?: MarketLocationSummary;
  selectListingMedia?: (input: {
    currentAssetIds: readonly string[];
    maxAssets: number;
  }) => Promise<string[]>;
  messaging?: MarketMessagingPort;
  handleSafetyIntent?: (intent: MarketSafetyIntent) => Promise<void>;
  resolveMediaAssetUrl: (mediaAssetId: string) => string | undefined;
  unavailableReason?: string;
};

let installedRuntime: MarketRuntime | undefined;

/**
 * Composition scaffold for the shared bootstrap. The live Mercado overlay
 * replaces this file during runtime composition with the feature-owned runtime,
 * including development-preview behavior. Keeping this minimal scaffold here
 * lets the composition source typecheck and bundle before overlays are applied.
 */
export function installMarketRuntime(runtime: MarketRuntime): () => void {
  installedRuntime = runtime;
  return () => {
    if (installedRuntime === runtime) installedRuntime = undefined;
  };
}

export function getMarketRuntime(): MarketRuntime {
  if (installedRuntime) return installedRuntime;
  return {
    mode: 'unavailable',
    resolveMediaAssetUrl: () => undefined,
    unavailableReason: 'Mercado no está disponible en este momento.',
  };
}

export function isMarketRuntimeWritable(
  runtime: MarketRuntime,
): runtime is MarketRuntime & {
  read: MarketReadPort;
  mutation: MarketMutationPort;
} {
  return Boolean(runtime.read && runtime.mutation);
}
