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
  AuthCapabilities,
  AuthProvider,
  AuthSession,
  AuthState,
  InteractiveAuthPort,
} from '../../../src/ports/authPort';
import { AuthPortError } from '../../../src/ports/authPort';
import { createSupabaseAuthPort } from '../adapters/createSupabaseAuthPort';

type RuntimeState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'email_sent'; email: string }
  | { status: 'signed_in'; session: AuthSession }
  | { status: 'error'; message: string; code?: string };

type AuthRuntimeContextValue = {
  state: RuntimeState;
  capabilities: AuthCapabilities | null;
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

function toRuntimeState(state: AuthState): RuntimeState {
  if (state.status === 'signed_in') {
    return { status: 'signed_in', session: state.session };
  }
  return state.status === 'unknown'
    ? { status: 'loading' }
    : { status: 'signed_out' };
}

function hasAnyLoginMethod(capabilities: AuthCapabilities): boolean {
  return capabilities.apple || capabilities.google || capabilities.email;
}

export function AuthRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RuntimeState>({ status: 'loading' });
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);
  const [busy, setBusy] = useState(false);

  const portResult = useMemo(() => {
    try {
      return { port: createSupabaseAuthPort(), error: null as unknown | null };
    } catch (error) {
      return { port: null, error };
    }
  }, []);

  const loadCapabilities = useCallback(async () => {
    if (!portResult.port) throw portResult.error;
    const next = await portResult.port.getCapabilities();
    if (!hasAnyLoginMethod(next)) {
      throw new AuthPortError(
        'provider_unavailable',
        '현재 사용할 수 있는 로그인 방식이 없습니다.',
      );
    }
    setCapabilities(next);
    return next;
  }, [portResult]);

  const restore = useCallback(async () => {
    if (!portResult.port) {
      setState(visibleError(portResult.error));
      return;
    }
    setBusy(true);
    try {
      const authState = await portResult.port.getState();
      if (authState.status === 'signed_in') {
        setState(toRuntimeState(authState));
        void loadCapabilities().catch(() => undefined);
        return;
      }
      await loadCapabilities();
      setState(toRuntimeState(authState));
    } catch (error) {
      setState(visibleError(error));
    } finally {
      setBusy(false);
    }
  }, [loadCapabilities, portResult]);

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
        if (authState.status === 'signed_out') {
          setState({ status: 'loading' });
          void loadCapabilities()
            .then(() => setState({ status: 'signed_out' }))
            .catch((error) => setState(visibleError(error)));
          return;
        }
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
  }, [handleIncomingUrl, loadCapabilities, portResult, restore]);

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
        if (error instanceof AuthPortError && error.code === 'oauth_cancelled') {
          setState({ status: 'signed_out' });
        } else {
          setState(visibleError(error));
        }
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
      await loadCapabilities();
      setState({ status: 'signed_out' });
    } catch (error) {
      setState(visibleError(error));
    } finally {
      setBusy(false);
    }
  }, [loadCapabilities, portResult]);

  const value = useMemo<AuthRuntimeContextValue>(
    () => ({
      state,
      capabilities,
      busy,
      signInWithOAuth,
      signInWithEmail,
      signOut,
      retry: restore,
    }),
    [
      busy,
      capabilities,
      restore,
      signInWithEmail,
      signInWithOAuth,
      signOut,
      state,
    ],
  );

  return (
    <AuthRuntimeContext.Provider value={value}>
      {children}
    </AuthRuntimeContext.Provider>
  );
}

export function useAuthRuntime() {
  const value = useContext(AuthRuntimeContext);
  if (!value) throw new Error('AuthRuntimeProvider is missing');
  return value;
}
