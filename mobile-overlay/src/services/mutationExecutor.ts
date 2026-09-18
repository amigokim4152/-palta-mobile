import type { OfflineMutation } from '../../../src/mobile/offlineMutationQueue';
import type {
  MutationExecutor,
  MutationExecutorResult,
} from '../../../src/mobile/mutationSyncEngine';
import { isRetryableMutationError } from '../../../src/api/retryPolicy';
import type { MobilePaltaClient } from './paltaClient';

type QuoteSourceContext = 'business_detail';

type QuotePayload = {
  businessId: string;
  description?: string;
  sourceContext?: QuoteSourceContext;
  photoRefs?: string[];
};

function readQuotePayload(
  mutation: OfflineMutation,
): QuotePayload | null {
  const payload = mutation.payload;
  if (typeof payload.businessId !== 'string') {
    return null;
  }

  const description =
    typeof payload.description === 'string' && payload.description.trim()
      ? payload.description
      : undefined;
  const sourceContext =
    payload.sourceContext === 'business_detail'
      ? payload.sourceContext
      : undefined;

  // Accept both the legacy user-description shape and the new language-neutral
  // system-origin shape. Empty machine-generated requests are invalid.
  if (!description && !sourceContext) {
    return null;
  }

  return {
    businessId: payload.businessId,
    ...(description ? { description } : {}),
    ...(sourceContext ? { sourceContext } : {}),
    ...(Array.isArray(payload.photoRefs)
      ? {
          photoRefs: payload.photoRefs.filter(
            (value): value is string => typeof value === 'string',
          ),
        }
      : {}),
  };
}

export function createMobileMutationExecutor(
  client: MobilePaltaClient,
): MutationExecutor {
  return async (
    mutation: OfflineMutation,
  ): Promise<MutationExecutorResult> => {
    if (mutation.kind !== 'business_quote_request') {
      return {
        ok: false,
        retryable: false,
        error: `unsupported_mutation_kind:${mutation.kind}`,
      };
    }

    const payload = readQuotePayload(mutation);
    if (!payload) {
      return {
        ok: false,
        retryable: false,
        error: 'invalid_quote_payload',
      };
    }

    try {
      await client.createCare({
        intentKey: 'local_business_quote',
        subjectEntityId: payload.businessId,
        actionType: 'quote_request',
        payload: {
          ...(payload.description
            ? { description: payload.description }
            : {}),
          photo_refs: payload.photoRefs ?? [],
          ...(payload.sourceContext
            ? { source_context: payload.sourceContext }
            : {}),
        },
        idempotencyKey: mutation.id,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        retryable: isRetryableMutationError(error),
        error: error instanceof Error ? error.message : 'mutation_failed',
      };
    }
  };
}
