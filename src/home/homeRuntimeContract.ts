import type { HomeApiItem } from '../api/paltaApiClient.js';

export type HomeGlanceItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  exceptional?: boolean;
};

/**
 * Runtime Home contract used by the mobile composition layer.
 *
 * `items` stays compatible with the existing Home API candidate contract.
 * `glance` is reserved for compact ambient context such as weather, nearby
 * transit ETA and system status. Glance must never become a second dashboard.
 */
export type HomeRuntimeResponse = {
  generated_at?: string;
  locality_label?: string;
  glance?: HomeGlanceItem[];
  items: HomeApiItem[];
};
