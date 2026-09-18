import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';

import {
  SUPPORTED_LOCALES,
  resolvePreferredLocale,
  resolveSignedInLocalePreference,
  t as translate,
  tryNormalizeLocale,
  type PaltaLocale,
  type UiInterpolation,
  type UiKey,
} from '../../../src/localization/index';
import { createLocalePreferencePort } from '../adapters/createLocalePreferencePort.native';
import { useAuthRuntime } from './AuthRuntimeProvider';

const LOCAL_LOCALE_KEY = 'palta.preferred-locale.local';

type LocalizationContextValue = {
  locale: PaltaLocale;
  supportedLocales: readonly PaltaLocale[];
  loading: boolean;
  t(key: UiKey, values?: UiInterpolation): string;
  setLocale(locale: PaltaLocale): Promise<void>;
};

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { state } = useAuthRuntime();
  const [locale, setLocaleState] = useState<PaltaLocale>(() =>
    resolvePreferredLocale({}),
  );
  const [loading, setLoading] = useState(true);
  const port = useMemo(() => createLocalePreferencePort(), []);

  useEffect(() => {
    let cancelled = false;

    async function restorePreference() {
      setLoading(true);
      try {
        const localStored = tryNormalizeLocale(
          await SecureStore.getItemAsync(LOCAL_LOCALE_KEY),
        );

        if (state.status === 'signed_in') {
          const accountId = String(state.session.paltaUserId);
          const accessToken = state.session.accessToken;
          const remote = await port.get(accountId, accessToken);
          const resolved = resolveSignedInLocalePreference({
            remoteLocale: remote?.preferredLocale,
            remoteExplicit: remote?.explicit,
            localExplicitLocale: localStored,
          });

          if (!cancelled) setLocaleState(resolved.locale);

          if (resolved.promoteLocalToAccount) {
            try {
              await port.set(accountId, accessToken, resolved.locale);
            } catch {
              // Keep the explicit local choice visible even if account persistence
              // is temporarily unavailable. A later settings change can retry it.
            }
          }
          return;
        }

        const next = resolvePreferredLocale({
          storedLocale: localStored,
          storedLocaleExplicit: Boolean(localStored),
        });
        if (!cancelled) setLocaleState(next);
      } catch {
        if (!cancelled) {
          setLocaleState(resolvePreferredLocale({}));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restorePreference();
    return () => {
      cancelled = true;
    };
  }, [port, state]);

  const setLocale = useCallback(
    async (nextLocale: PaltaLocale) => {
      const previous = locale;
      setLocaleState(nextLocale);
      await SecureStore.setItemAsync(LOCAL_LOCALE_KEY, nextLocale);

      if (state.status !== 'signed_in') return;

      try {
        await port.set(
          String(state.session.paltaUserId),
          state.session.accessToken,
          nextLocale,
        );
      } catch (error) {
        setLocaleState(previous);
        await SecureStore.setItemAsync(LOCAL_LOCALE_KEY, previous);
        throw error;
      }
    },
    [locale, port, state],
  );

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale,
      supportedLocales: SUPPORTED_LOCALES,
      loading,
      t: (key, values) => translate(key, locale, values),
      setLocale,
    }),
    [loading, locale, setLocale],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}


export function PreviewLocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PaltaLocale>(() =>
    resolvePreferredLocale({}),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restorePreference() {
      try {
        const localStored = tryNormalizeLocale(
          await SecureStore.getItemAsync(LOCAL_LOCALE_KEY),
        );
        const next = resolvePreferredLocale({
          storedLocale: localStored,
          storedLocaleExplicit: Boolean(localStored),
        });
        if (!cancelled) setLocaleState(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restorePreference();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: PaltaLocale) => {
    setLocaleState(nextLocale);
    await SecureStore.setItemAsync(LOCAL_LOCALE_KEY, nextLocale);
  }, []);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale,
      supportedLocales: SUPPORTED_LOCALES,
      loading,
      t: (key, values) => translate(key, locale, values),
      setLocale,
    }),
    [loading, locale, setLocale],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error('LocalizationProvider is missing');
  return value;
}
