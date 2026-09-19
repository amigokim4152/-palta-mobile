import type { PaltaLocale } from '../../../src/localization/index';

export interface RemoteLocalePreference {
  preferredLocale: string;
  explicit: boolean;
}

export interface LocalePreferencePort {
  get(userId: string, accessToken: string): Promise<RemoteLocalePreference | null>;
  set(userId: string, accessToken: string, locale: PaltaLocale): Promise<void>;
}

function config() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new Error('supabase_public_config_required');
  }

  if (!url.startsWith('https://') || !url.endsWith('.supabase.co')) {
    throw new Error('supabase_public_url_invalid');
  }

  if (!key.startsWith('sb_publishable_')) {
    throw new Error('supabase_publishable_key_invalid');
  }

  return {
    url: url.replace(/\/$/, ''),
    key,
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
