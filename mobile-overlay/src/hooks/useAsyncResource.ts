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
    /**
     * Optional immediately usable data. The hook still refreshes in the
     * background, preserving the supplied data while loading.
     */
    initialData?: T;
  },
) {
  const enabled = options?.enabled ?? true;
  const initialData = options?.initialData;
  const isEmptyRef = useRef(options?.isEmpty);
  isEmptyRef.current = options?.isEmpty;

  const [state, setState] = useState<AsyncResource<T>>(() => {
    if (initialData !== undefined) {
      return {
        status: options?.isEmpty?.(initialData) ? 'empty' : 'ready',
        data: initialData,
      };
    }
    return {
      status: enabled ? 'loading' : 'empty',
    } as AsyncResource<T>;
  });
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
        status: isEmptyRef.current?.(data) ? 'empty' : 'ready',
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
  }, [enabled, loader]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [enabled, refresh]);

  return { state, refresh };
}
