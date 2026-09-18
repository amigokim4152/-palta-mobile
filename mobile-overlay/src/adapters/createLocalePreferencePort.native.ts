import type { PaltaLocale } from '../../../src/localization/index';

const PALTA_DEV_URL = 'https://rqbpbauhkdgsrkbwmkmg.supabase.co';
const PALTA_DEV_PUBLISHABLE_KEY =
  'sb_publishable_QEHIwvil9m4lyE6kJ1ba6w_CjA9_XXh';

export interface RemoteLocalePreference {
  preferredLocale: string;
  explicit: boolean;
}

export interface LocalePreferencePort {
  get(userId: string, accessToken: string): Promise<RemoteLocalePreference | null>;
  set(userId: string, accessToken: string, locale: PaltaLocale): Promise<void>;
}

function config() {
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || PALTA_DEV_URL,
    key:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      PALTA_DEV_PUBLISHABLE_KEY,
  };
}

function headers(accessToken: string, json = false): Record<string, string> {
  const { key } = config();
  return {
    apikey: key,
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

function accountUrl(userId: string, select?: string) {
  const { url } = config();
  const query = new URLSearchParams({ user_id: `eq.${userId}` });
  if (select) query.set('select', select);
  return `${url}/rest/v1/palta_account?${query.toString()}`;
}

export function createLocalePreferencePort(): LocalePreferencePort {
  return {
    async get(userId, accessToken) {
      const response = await fetch(
        accountUrl(userId, 'preferred_locale,preferred_locale_explicit'),
        { headers: headers(accessToken) },
      );
      if (!response.ok) {
        throw new Error(`locale_preference_read_failed:${response.status}`);
      }

      const rows = (await response.json()) as Array<{
        preferred_locale?: unknown;
        preferred_locale_explicit?: unknown;
      }>;
      const row = rows[0];
      if (!row) return null;

      return {
        preferredLocale:
          typeof row.preferred_locale === 'string'
            ? row.preferred_locale
            : 'es-CL',
        explicit: row.preferred_locale_explicit === true,
      };
    },

    async set(userId, accessToken, locale) {
      const response = await fetch(accountUrl(userId), {
        method: 'PATCH',
        headers: {
          ...headers(accessToken, true),
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          preferred_locale: locale,
          preferred_locale_explicit: true,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`locale_preference_write_failed:${response.status}`);
      }
    },
  };
}
