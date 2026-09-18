import {
  createMarketHttpPorts,
  type MarketHttpTransport,
} from '../../../../src/market/marketHttpAdapter';
import type { MarketRuntime } from './marketRuntime';

export type CreateMarketLiveRuntimeInput = {
  /** Shared runtime transport owns API base URL, auth token and fetch policy. */
  transport: MarketHttpTransport;
  /** Shared Media Core resolver. Mercado never builds raw storage URLs itself. */
  resolveMediaAssetUrl: (mediaAssetId: string) => string | undefined;
};

/**
 * Composition-layer entry point for production Mercado data.
 *
 * This factory deliberately accepts shared adapters instead of importing Auth,
 * Media or the global Palta API client directly. integration/runtime-composition-v1
 * can install the result with installMarketRuntime() after those Shared Cores
 * are reconciled.
 */
export function createMarketLiveRuntime(
  input: CreateMarketLiveRuntimeInput,
): MarketRuntime {
  const ports = createMarketHttpPorts(input.transport);
  return {
    mode: 'live',
    read: ports.read,
    mutation: ports.mutation,
    resolveMediaAssetUrl: input.resolveMediaAssetUrl,
  };
}
