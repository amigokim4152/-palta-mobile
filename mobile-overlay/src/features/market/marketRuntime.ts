import type {
  MarketMutationPort,
  MarketReadPort,
} from '../../../../src/market/marketApiContract';
import type { MarketMessagingPort } from '../../../../src/market/marketMessagingFlow';
import type { MarketLocationSummary } from '../../../../src/market/marketPersistenceContract';
import type { MarketSafetyIntent } from '../../../../src/market/marketSafetyIntent';
import { createMarketDevelopmentRuntime } from './marketRuntimeDevelopment';

export type MarketRuntimeMode =
  | 'live'
  | 'development_preview'
  | 'unavailable';

export type MarketRuntime = {
  mode: MarketRuntimeMode;
  read?: MarketReadPort;
  mutation?: MarketMutationPort;
  /** Coarse public area supplied by shared Location Core; never exact coordinates. */
  publicArea?: MarketLocationSummary;
  /** Shared Media Core picker/uploader returns already-owned asset ids. */
  selectListingMedia?: (input: {
    currentAssetIds: readonly string[];
    maxAssets: number;
  }) => Promise<string[]>;
  /** Shared Message Core relationship/opening bridge. */
  messaging?: MarketMessagingPort;
  /** Shared Safety/Moderation boundary owns hide/report persistence and audit. */
  handleSafetyIntent?: (intent: MarketSafetyIntent) => Promise<void>;
  resolveMediaAssetUrl: (mediaAssetId: string) => string | undefined;
  unavailableReason?: string;
};

let installedRuntime: MarketRuntime | undefined;
let developmentRuntime: MarketRuntime | undefined;

export function installMarketRuntime(runtime: MarketRuntime): () => void {
  installedRuntime = runtime;
  return () => {
    if (installedRuntime === runtime) installedRuntime = undefined;
  };
}

export function getMarketRuntime(): MarketRuntime {
  if (installedRuntime) return installedRuntime;

  if (__DEV__) {
    developmentRuntime ??= createMarketDevelopmentRuntime();
    return developmentRuntime;
  }

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
