import type {
  MarketMutationPort,
  MarketReadPort,
} from '../../../../src/market/marketApiContract';
import type { MarketMessagingPort } from '../../../../src/market/marketMessagingFlow';
import type {
  MarketLocationSummary,
  MarketTransactionRecord,
} from '../../../../src/market/marketPersistenceContract';
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

const previewConversationByCounterparty = new Map<string, string>();
const previewActiveTransactionByListing = new Map<string, MarketTransactionRecord>();

function createComposedMarketDevelopmentRuntime(): MarketRuntime {
  const base = createMarketDevelopmentRuntime();
  if (!base.mutation) return base;

  const baseMutation = base.mutation;
  const mutation: MarketMutationPort = {
    ...baseMutation,
    async startTransaction(command) {
      const existing = previewActiveTransactionByListing.get(command.listingId);
      if (
        existing &&
        (existing.status === 'coordinating' || existing.status === 'reserved')
      ) {
        if (
          command.conversationId &&
          existing.conversationId &&
          command.conversationId !== existing.conversationId
        ) {
          throw new Error(
            'Preview Mercado transaction is already bound to another conversation.',
          );
        }
        return existing;
      }

      const created = await baseMutation.startTransaction(command);
      previewActiveTransactionByListing.set(created.listingId, created);
      return created;
    },
    async reserveTransaction(command) {
      const updated = await baseMutation.reserveTransaction(command);
      previewActiveTransactionByListing.set(updated.listingId, updated);
      return updated;
    },
    async completeTransaction(command) {
      const updated = await baseMutation.completeTransaction(command);
      previewActiveTransactionByListing.delete(updated.listingId);
      return updated;
    },
    async cancelTransaction(command) {
      const updated = await baseMutation.cancelTransaction(command);
      previewActiveTransactionByListing.delete(updated.listingId);
      return updated;
    },
  };

  const messaging: MarketMessagingPort = {
    async ensurePeerConversation({ counterpartyUserId }) {
      let conversationId = previewConversationByCounterparty.get(counterpartyUserId);
      if (!conversationId) {
        conversationId = `preview-conversation:${counterpartyUserId}`;
        previewConversationByCounterparty.set(counterpartyUserId, conversationId);
      }
      return { conversationId };
    },
    async openConversation() {
      // Development preview deliberately does not create a second chat UI/store.
      // The screen still executes the real Mercado orchestration before showing
      // its preview-ready state.
    },
  };

  return {
    ...base,
    mutation,
    messaging,
  };
}

export function installMarketRuntime(runtime: MarketRuntime): () => void {
  installedRuntime = runtime;
  return () => {
    if (installedRuntime === runtime) installedRuntime = undefined;
  };
}

/**
 * Explicit preview entrypoint used by the composed PWA preview only.
 * Production/native runtime wiring never selects this unless the preview flag
 * is set by the deployment workflow.
 */
export function createMarketPreviewRuntime(): MarketRuntime {
  developmentRuntime ??= createComposedMarketDevelopmentRuntime();
  return developmentRuntime;
}

export function getMarketRuntime(): MarketRuntime {
  if (installedRuntime) return installedRuntime;

  if (__DEV__) {
    return createMarketPreviewRuntime();
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
