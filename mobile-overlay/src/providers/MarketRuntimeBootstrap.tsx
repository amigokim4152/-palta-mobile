import { router } from 'expo-router';
import { useEffect } from 'react';
import { createMarketHttpTransport } from '../../../src/api/marketHttpTransport';
import { parseRuntimeEnv } from '../../../src/config/runtimeEnv';
import { createMarketHttpPorts } from '../../../src/market/marketHttpAdapter';
import type { MarketMessagingPort } from '../../../src/market/marketMessagingFlow';
import { createSupabaseAuthPort } from '../adapters/createSupabaseAuthPort';
import { installMarketRuntime } from '../features/market/marketRuntime';
import { getAuthenticatedMobileRuntime } from '../services/paltaClient';

function createFetchLike() {
  return async (input: string, init?: RequestInit) => {
    const response = await fetch(input, init);
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
    };
  };
}

/**
 * Composition-owned live Mercado wiring.
 * Mercado owns product behavior; shared runtime owns network/auth and Message Core.
 */
export function MarketRuntimeBootstrap() {
  useEffect(() => {
    let dispose: (() => void) | undefined;

    try {
      const env = parseRuntimeEnv({
        EXPO_PUBLIC_PALTA_API_BASE_URL:
          process.env.EXPO_PUBLIC_PALTA_API_BASE_URL,
        EXPO_PUBLIC_MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
        EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
      });
      const auth = createSupabaseAuthPort();
      const fetchLike = createFetchLike();
      const transport = createMarketHttpTransport({
        baseUrl: env.apiBaseUrl,
        fetch: fetchLike,
        getAccessToken: () => auth.getAccessToken(),
      });
      const market = createMarketHttpPorts(transport);

      const messaging: MarketMessagingPort = {
        async ensurePeerConversation({ counterpartyUserId }) {
          const runtime = getAuthenticatedMobileRuntime();
          if (runtime.status !== 'ready') throw new Error(runtime.message);
          const conversation =
            await runtime.client.messaging.openDirectUserConversation(
              counterpartyUserId,
            );
          return { conversationId: conversation.conversation_id };
        },

        async openConversation({
          conversationId,
          focus,
          initialText,
        }) {
          router.push({
            pathname: '/messages/[conversationId]',
            params: {
              conversationId,
              contextSourceCore: focus.sourceCore,
              contextResourceType: focus.resourceType,
              contextResourceId: focus.resourceId,
              contextLabel: focus.label,
              ...(initialText ? { initialText } : {}),
            },
          });
        },
      };

      dispose = installMarketRuntime({
        mode: 'live',
        read: market.read,
        mutation: market.mutation,
        messaging,
        // Media Core owns signed/public asset URL resolution. Until that shared
        // resolver is injected, Mercado must not guess a storage URL.
        resolveMediaAssetUrl: () => undefined,
      });
    } catch {
      // marketRuntime keeps its explicit unavailable fallback when shared
      // runtime configuration is invalid. Do not install a partial live runtime.
    }

    return () => {
      dispose?.();
    };
  }, []);

  return null;
}
