import {
  createMarketHttpPorts,
  type MarketHttpTransport,
} from '../../../../src/market/marketHttpAdapter';
import type { MarketMessageIntent } from '../../../../src/market/marketMessageIntent';
import type { MarketLocationSummary } from '../../../../src/market/marketPersistenceContract';
import type { MarketRuntime } from './marketRuntime';

export type CreateMarketLiveRuntimeInput = {
  /** Shared runtime transport owns API base URL, auth token and fetch policy. */
  transport: MarketHttpTransport;
  /** Coarse public area selected/resolved by shared Location Core. */
  publicArea?: MarketLocationSummary;
  /** Shared Media Core resolver. Mercado never builds raw storage URLs itself. */
  resolveMediaAssetUrl: (mediaAssetId: string) => string | undefined;
  /** Shared Media Core picker/uploader; returned ids are ready for listing persistence. */
  selectListingMedia?: (input: {
    currentAssetIds: readonly string[];
    maxAssets: number;
  }) => Promise<string[]>;
  /** Shared Message Core handoff. */
  openMessageIntent?: (intent: MarketMessageIntent) => Promise<void>;
};

/**
 * Composition-layer entry point for production Mercado data.
 *
 * This factory deliberately accepts shared adapters instead of importing Auth,
 * Media, Location, Messaging or the global Palta API client directly.
 * integration/runtime-composition-v1 can install the result with
 * installMarketRuntime() after those Shared Cores are reconciled.
 */
export function createMarketLiveRuntime(
  input: CreateMarketLiveRuntimeInput,
): MarketRuntime {
  const ports = createMarketHttpPorts(input.transport);
  return {
    mode: 'live',
    read: ports.read,
    mutation: ports.mutation,
    ...(input.publicArea ? { publicArea: input.publicArea } : {}),
    ...(input.selectListingMedia
      ? { selectListingMedia: input.selectListingMedia }
      : {}),
    ...(input.openMessageIntent
      ? { openMessageIntent: input.openMessageIntent }
      : {}),
    resolveMediaAssetUrl: input.resolveMediaAssetUrl,
  };
}
