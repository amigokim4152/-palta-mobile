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

function deviceLocales(): string[] {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale ? [locale] : [];
  } catch {
    return [];
  }
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { state } = useAuthRuntime();
  const [locale, setLocaleState] = useState<PaltaLocale>(() =>
    resolvePreferredLocale({ deviceLocales: deviceLocales() }),
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
          const remote = await port.get(
            String(state.session.paltaUserId),
            state.session.accessToken,
          );
          const next = resolvePreferredLocale({
            storedLocale: remote?.explicit ? remote.preferredLocale : localStored,
            storedLocaleExplicit: Boolean(remote?.explicit || localStored),
            deviceLocales: deviceLocales(),
          });
          if (!cancelled) setLocaleState(next);
          return;
        }

        const next = resolvePreferredLocale({
          storedLocale: localStored,
          storedLocaleExplicit: Boolean(localStored),
          deviceLocales: deviceLocales(),
        });
        if (!cancelled) setLocaleState(next);
      } catch {
        if (!cancelled) {
          setLocaleState(resolvePreferredLocale({ deviceLocales: deviceLocales() }));
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

export function useLocalization() {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error('LocalizationProvider is missing');
  return value;
}
