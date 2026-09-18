import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as Linking from 'expo-linking';

import type {
  AuthProvider,
  AuthSession,
  InteractiveAuthPort,
} from '../../../src/ports/authPort';
import { AuthPortError } from '../../../src/ports/authPort';
import { createSupabaseAuthPort } from '../adapters/createSupabaseAuthPort.native';

type RuntimeState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'email_sent'; email: string }
  | { status: 'signed_in'; session: AuthSession }
  | { status: 'error'; message: string; code?: string };

type AuthRuntimeContextValue = {
  state: RuntimeState;
  busy: boolean;
  signInWithOAuth(provider: AuthProvider): Promise<void>;
  signInWithEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
  retry(): Promise<void>;
};

const AuthRuntimeContext = createContext<AuthRuntimeContextValue | null>(null);

function visibleError(error: unknown): RuntimeState {
  if (error instanceof AuthPortError) {
    return { status: 'error', message: error.message, code: error.code };
  }
  if (error instanceof Error) {
    return { status: 'error', message: error.message };
  }
  return {
    status: 'error',
    message: '로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.',
  };
}

function toRuntimeState(
  state: Awaited<ReturnType<InteractiveAuthPort['getState']>>,
): RuntimeState {
  if (state.status === 'signed_in') {
    return { status: 'signed_in', session: state.session };
  }
  return state.status === 'unknown'
    ? { status: 'loading' }
    : { status: 'signed_out' };
}

export function AuthRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RuntimeState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  const portResult = useMemo(() => {
    try {
      return { port: createSupabaseAuthPort(), error: null as unknown | null };
    } catch (error) {
      return { port: null, error };
    }
  }, []);

  const restore = useCallback(async () => {
    if (!portResult.port) {
      setState(visibleError(portResult.error));
      return;
    }
    setBusy(true);
    try {
      const authState = await portResult.port.getState();
      setState(toRuntimeState(authState));
    } catch (error) {
      setState(visibleError(error));
    } finally {
      setBusy(false);
    }
  }, [portResult]);

  const handleIncomingUrl = useCallback(
    async (url: string | null) => {
      if (!url || !url.includes('auth/callback') || !portResult.port) return;
      setBusy(true);
      try {
        const authState = await portResult.port.handleRedirect(url);
        setState(toRuntimeState(authState));
      } catch (error) {
        setState(visibleError(error));
      } finally {
        setBusy(false);
      }
    },
    [portResult.port],
  );

  useEffect(() => {
    if (!portResult.port) {
      setState(visibleError(portResult.error));
      return;
    }

    void Linking.getInitialURL().then(async (url) => {
      if (url?.includes('auth/callback')) await handleIncomingUrl(url);
      else await restore();
    });

    const unsubscribeAuth = portResult.port.subscribe(
      (authState) => {
        setState(toRuntimeState(authState));
      },
      (error) => {
        setBusy(false);
        setState(visibleError(error));
      },
    );
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingUrl(url);
    });

    return () => {
      unsubscribeAuth();
      linkingSubscription.remove();
    };
  }, [handleIncomingUrl, portResult, restore]);

  const signInWithOAuth = useCallback(
    async (provider: AuthProvider) => {
      if (!portResult.port) {
        setState(visibleError(portResult.error));
        return;
      }
      setBusy(true);
      try {
        const authState = await portResult.port.signInWithOAuth(provider);
        setState(toRuntimeState(authState));
      } catch (error) {
        setState(visibleError(error));
      } finally {
        setBusy(false);
      }
    },
    [portResult],
  );

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!portResult.port) {
        setState(visibleError(portResult.error));
        return;
      }
      setBusy(true);
      try {
        await portResult.port.signInWithEmail(email);
        setState({ status: 'email_sent', email });
      } catch (error) {
        setState(visibleError(error));
      } finally {
        setBusy(false);
      }
    },
    [portResult],
  );

  const signOut = useCallback(async () => {
    if (!portResult.port) {
      setState(visibleError(portResult.error));
      return;
    }
    setBusy(true);
    try {
      await portResult.port.signOut();
      setState({ status: 'signed_out' });
    } catch (error) {
      setState(visibleError(error));
    } finally {
      setBusy(false);
    }
  }, [portResult]);

  const value = useMemo<AuthRuntimeContextValue>(
    () => ({
      state,
      busy,
      signInWithOAuth,
      signInWithEmail,
      signOut,
      retry: restore,
    }),
    [busy, restore, signInWithEmail, signInWithOAuth, signOut, state],
  );

  return (
    <AuthRuntimeContext.Provider value={value}>
      {children}
    </AuthRuntimeContext.Provider>
  );
}

export function useAuthRuntime() {
  const value = useContext(AuthRuntimeContext);
  if (!value) {
    throw new Error('AuthRuntimeProvider is missing');
  }
  return value;
}
