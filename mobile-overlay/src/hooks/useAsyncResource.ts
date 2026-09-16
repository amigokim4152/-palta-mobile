import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncResource<T> =
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'empty'; data: T }
  | { status: 'error'; data?: T; message: string };

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  options?: {
    isEmpty?: (value: T) => boolean;
    enabled?: boolean;
  },
) {
  const enabled = options?.enabled ?? true;
  const [state, setState] = useState<AsyncResource<T>>({
    status: enabled ? 'loading' : 'empty',
  } as AsyncResource<T>);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    const current = ++generation.current;
    setState((previous) => ({
      status: 'loading',
      ...('data' in previous && previous.data !== undefined
        ? { data: previous.data }
        : {}),
    }));

    try {
      const data = await loader();
      if (current !== generation.current) return;
      setState({
        status: options?.isEmpty?.(data) ? 'empty' : 'ready',
        data,
      });
    } catch (error) {
      if (current !== generation.current) return;
      setState((previous) => ({
        status: 'error',
        ...('data' in previous && previous.data !== undefined
          ? { data: previous.data }
          : {}),
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [enabled, loader, options?.isEmpty]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [enabled, refresh]);

  return { state, refresh };
}
