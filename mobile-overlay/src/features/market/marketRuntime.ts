import type {
  MarketMutationPort,
  MarketReadPort,
} from '../../../../src/market/marketApiContract';
import { createMarketDevelopmentRuntime } from './marketRuntimeDevelopment';

export type MarketRuntimeMode =
  | 'live'
  | 'development_preview'
  | 'unavailable';

export type MarketRuntime = {
  mode: MarketRuntimeMode;
  read?: MarketReadPort;
  mutation?: MarketMutationPort;
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
    unavailableReason:
      'Mercado todavía no tiene un adaptador de datos instalado para este runtime.',
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
