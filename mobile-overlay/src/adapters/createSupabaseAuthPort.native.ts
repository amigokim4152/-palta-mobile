import 'react-native-url-polyfill/auto';

import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createClient, type Session } from '@supabase/supabase-js';

import type { PaltaUserId } from '../../../src/auth/accountModel';
import type {
  AuthCapabilities,
  AuthProvider,
  InteractiveAuthPort,
} from '../../../src/ports/authPort';
import { AuthPortError } from '../../../src/ports/authPort';
import {
  SupabaseAuthAdapter,
  type ProviderSession,
  type SupabaseAuthBridge,
} from './supabaseAuthAdapter';

let singleton: InteractiveAuthPort | null = null;
let appStateBound = false;

function getPublicConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new AuthPortError(
      'configuration_error',
      '로그인 서비스 설정이 없습니다. 앱 설정을 확인한 뒤 다시 시도해 주세요.',
    );
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    throw new AuthPortError(
      'configuration_error',
      'Supabase URL 설정이 올바르지 않습니다.',
    );
  }

  if (!key.startsWith('sb_publishable_')) {
    throw new AuthPortError(
      'configuration_error',
      '모바일에는 Supabase publishable key만 사용할 수 있습니다.',
    );
  }

  return { url, key };
}

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function toProviderSession(session: Session | null): ProviderSession {
  if (!session) return null;
  return {
    access_token: session.access_token,
    ...(typeof session.expires_at === 'number'
      ? { expires_at: session.expires_at }
      : {}),
    user: {
      id: session.user.id,
      ...(session.user.email ? { email: session.user.email } : {}),
    },
  };
}

function getRedirectUrl() {
  return Linking.createURL('auth/callback', { scheme: 'palta' });
}

function codeFromRedirect(url: string): string {
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  if (!code) {
    throw new AuthPortError(
      'invalid_redirect',
      '로그인 반환 주소에 인증 코드가 없습니다.',
    );
  }
  return code;
}

export function createSupabaseAuthPort(): InteractiveAuthPort {
  if (singleton) return singleton;

  const { url, key } = getPublicConfig();
  WebBrowser.maybeCompleteAuthSession();

  const client = createClient(url, key, {
    auth: {
      storage: secureStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  if (!appStateBound) {
    appStateBound = true;
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }

  let capabilitiesCache:
    | { value: AuthCapabilities; validUntil: number }
    | undefined;

  const loadCapabilities = async (): Promise<AuthCapabilities> => {
    const now = Date.now();
    if (capabilitiesCache && capabilitiesCache.validUntil > now) {
      return capabilitiesCache.value;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: key },
        signal: controller.signal,
      });
    } catch (error) {
      throw new AuthPortError(
        'provider_error',
        '사용 가능한 로그인 방식을 확인하지 못했습니다.',
        error,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new AuthPortError(
        'provider_error',
        '로그인 서비스 상태를 확인하지 못했습니다.',
        new Error(`auth_settings_http_${response.status}`),
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new AuthPortError(
        'provider_error',
        '로그인 서비스 설정 응답을 확인하지 못했습니다.',
        error,
      );
    }

    const external =
      payload && typeof payload === 'object' &&
      'external' in payload &&
      payload.external &&
      typeof payload.external === 'object'
        ? (payload.external as Record<string, unknown>)
        : null;

    if (!external) {
      throw new AuthPortError(
        'provider_error',
        '로그인 서비스가 사용 가능한 인증 방식을 반환하지 않았습니다.',
      );
    }

    const value: AuthCapabilities = {
      apple: external.apple === true,
      google: external.google === true,
      email: external.email === true,
    };
    capabilitiesCache = { value, validUntil: now + 5 * 60_000 };
    return value;
  };

  const exchangedCodes = new Set<string>();
  const exchangeInFlight = new Map<string, Promise<void>>();
  const rememberExchangedCode = (code: string) => {
    exchangedCodes.add(code);
    while (exchangedCodes.size > 8) {
      const oldest = exchangedCodes.values().next().value as string | undefined;
      if (!oldest) break;
      exchangedCodes.delete(oldest);
    }
  };

  const exchangeRedirect = async (redirectUrl: string) => {
    const code = codeFromRedirect(redirectUrl);
    if (exchangedCodes.has(code)) return;

    const existing = exchangeInFlight.get(code);
    if (existing) return existing;

    const exchange = (async () => {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        throw new AuthPortError(
          'provider_error',
          '로그인 세션을 완료하지 못했습니다.',
          error,
        );
      }
      rememberExchangedCode(code);
    })();

    exchangeInFlight.set(code, exchange);
    try {
      await exchange;
    } finally {
      exchangeInFlight.delete(code);
    }
  };

  const bridge: SupabaseAuthBridge = {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw new AuthPortError(
          'provider_error',
          '저장된 로그인 세션을 확인하지 못했습니다.',
          error,
        );
      }
      return toProviderSession(data.session);
    },

    getCapabilities: loadCapabilities,

    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) {
        throw new AuthPortError(
          'provider_error',
          '로그아웃하지 못했습니다.',
          error,
        );
      }
    },

    subscribe(listener) {
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        listener(toProviderSession(session));
      });
      return () => subscription.unsubscribe();
    },

    async accountExists(userId: PaltaUserId) {
      const { data, error } = await client
        .from('palta_account')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new AuthPortError(
          'account_lookup_failed',
          'Palta 계정을 확인하지 못했습니다.',
          error,
        );
      }
      return data?.user_id === userId;
    },

    async signInWithOAuth(provider: AuthProvider) {
      const redirectTo = getRedirectUrl();
      const { data, error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) {
        throw new AuthPortError(
          'provider_error',
          `${provider} 로그인을 시작하지 못했습니다.`,
          error,
        );
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new AuthPortError('oauth_cancelled', '로그인이 취소되었습니다.');
      }
      if (result.type !== 'success' || !result.url) {
        throw new AuthPortError(
          'provider_error',
          '로그인 결과를 받지 못했습니다.',
        );
      }

      await exchangeRedirect(result.url);
    },

    async signInWithEmail(email: string) {
      const redirectTo = getRedirectUrl();
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });
      if (error) {
        throw new AuthPortError(
          'provider_error',
          '이메일 로그인 링크를 보내지 못했습니다.',
          error,
        );
      }
    },

    handleRedirect: exchangeRedirect,
  };

  singleton = new SupabaseAuthAdapter(bridge);
  return singleton;
}
