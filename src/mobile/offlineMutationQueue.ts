export type OfflineMutationState =
  | 'pending'
  | 'syncing'
  | 'failed_retryable'
  | 'failed_terminal';

export type OfflineMutation<TPayload = Record<string, unknown>> = {
  id: string;
  kind: string;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  state: OfflineMutationState;
  lastError?: string;
};

export function enqueueMutation<TPayload>(input: {
  id: string;
  kind: string;
  payload: TPayload;
  now: string;
}): OfflineMutation<TPayload> {
  return {
    id: input.id,
    kind: input.kind,
    payload: input.payload,
    createdAt: input.now,
    updatedAt: input.now,
    attempts: 0,
    state: 'pending',
  };
}

export function startMutation<TPayload>(
  mutation: OfflineMutation<TPayload>,
  now: string,
): OfflineMutation<TPayload> {
  const { lastError: _lastError, ...rest } = mutation;
  return {
    ...rest,
    updatedAt: now,
    attempts: mutation.attempts + 1,
    state: 'syncing',
  };
}

export function failMutation<TPayload>(
  mutation: OfflineMutation<TPayload>,
  input: { retryable: boolean; error: string; now: string },
): OfflineMutation<TPayload> {
  return {
    ...mutation,
    updatedAt: input.now,
    state: input.retryable ? 'failed_retryable' : 'failed_terminal',
    lastError: input.error,
  };
}

export function shouldRetryMutation(
  mutation: OfflineMutation,
  maxAttempts = 5,
): boolean {
  return mutation.state === 'failed_retryable' && mutation.attempts < maxAttempts;
}

export function pendingMutationsInOrder<TPayload>(
  mutations: readonly OfflineMutation<TPayload>[],
): OfflineMutation<TPayload>[] {
  return mutations
    .filter(
      (mutation) =>
        mutation.state === 'pending' || mutation.state === 'failed_retryable',
    )
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
