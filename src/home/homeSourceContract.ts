import type { HomeApiItem } from '../api/paltaApiClient.js';
import type { HomeDataMode, HomeGlanceItem } from './homeRuntimeContract.js';

export type HomeSourceDomain =
  | 'weather'
  | 'mobility'
  | 'public-life'
  | 'news'
  | 'care'
  | 'community'
  | 'school'
  | 'commerce'
  | 'delivery'
  | 'health'
  | 'vehicle'
  | 'pets'
  | 'local-business'
  | 'other';

export type HomeSourceContribution = {
  source_domain: HomeSourceDomain;
  data_mode: HomeDataMode;
  observed_at: string;
  expires_at?: string;
  locality_label?: string;
  glance?: HomeGlanceItem[];
  items?: HomeApiItem[];
  message?: string;
};

export function isContributionCurrent(
  contribution: HomeSourceContribution,
  now = new Date(),
): boolean {
  if (contribution.data_mode === 'unavailable') return false;
  if (!contribution.expires_at) return true;
  const expiresAt = Date.parse(contribution.expires_at);
  return Number.isFinite(expiresAt) && expiresAt >= now.getTime();
}

/**
 * Domains contribute data; Home owns composition and visual hierarchy.
 * Adapters must never invent a value merely because a Home slot exists.
 */
export interface HomeSourceAdapter<Input> {
  readonly sourceDomain: HomeSourceDomain;
  toHome(input: Input, now?: Date): HomeSourceContribution;
}
