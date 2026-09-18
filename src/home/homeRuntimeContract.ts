import type { HomeApiItem } from '../api/paltaApiClient.js';

export type HomeDataMode =
  | 'live'
  | 'cached'
  | 'scheduled'
  | 'demo'
  | 'unavailable';

export type HomeGlanceItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  exceptional?: boolean;
  source_domain?: string;
  data_mode?: HomeDataMode;
  observed_at?: string;
  expires_at?: string;
};

export type HomeSourceState = {
  source_domain: string;
  data_mode: HomeDataMode;
  observed_at?: string;
  expires_at?: string;
  message?: string;
};

/**
 * Runtime Home contract used by the mobile composition layer.
 *
 * `items` stays compatible with the existing Home API candidate contract.
 * `glance` is reserved for compact ambient context such as weather, nearby
 * transit ETA and system status. Glance must never become a second dashboard.
 *
 * `source_state` prevents development placeholders, cached data and real-time
 * data from being silently mixed. Production UI may keep this metadata hidden,
 * but observability and QA must retain it.
 */
export type HomeRuntimeResponse = {
  generated_at?: string;
  locality_label?: string;
  glance?: HomeGlanceItem[];
  source_state?: HomeSourceState[];
  items: HomeApiItem[];
};
