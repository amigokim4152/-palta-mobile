import type { HomeApiItem } from '../api/paltaApiClient.js';
import type {
  HomeDataMode,
  HomeGlanceItem,
  HomeRuntimeResponse,
} from './homeRuntimeContract.js';
import {
  isContributionCurrent,
  type HomeSourceContribution,
} from './homeSourceContract.js';

const MODE_RANK: Record<HomeDataMode, number> = {
  live: 5,
  cached: 4,
  scheduled: 3,
  demo: 2,
  unavailable: 0,
};

function chooseGlance(a: HomeGlanceItem, b: HomeGlanceItem): HomeGlanceItem {
  const aRank = MODE_RANK[a.data_mode ?? 'scheduled'];
  const bRank = MODE_RANK[b.data_mode ?? 'scheduled'];
  if (bRank !== aRank) return bRank > aRank ? b : a;

  const aObserved = a.observed_at ? Date.parse(a.observed_at) : 0;
  const bObserved = b.observed_at ? Date.parse(b.observed_at) : 0;
  return bObserved > aObserved ? b : a;
}

function chooseItem(a: HomeApiItem, b: HomeApiItem): HomeApiItem {
  const deliveryRank: Record<HomeApiItem['delivery'], number> = {
    home: 1,
    home_notify: 2,
    urgent: 3,
  };
  return deliveryRank[b.delivery] > deliveryRank[a.delivery] ? b : a;
}

export function mergeHomeSources(
  contributions: readonly HomeSourceContribution[],
  options: { now?: Date; maxGlance?: number } = {},
): HomeRuntimeResponse {
  const now = options.now ?? new Date();
  const maxGlance = options.maxGlance ?? 4;
  const current = contributions.filter((item) => isContributionCurrent(item, now));

  const glanceById = new Map<string, HomeGlanceItem>();
  const itemById = new Map<string, HomeApiItem>();

  for (const contribution of current) {
    for (const raw of contribution.glance ?? []) {
      const item: HomeGlanceItem = {
        ...raw,
        source_domain: raw.source_domain ?? contribution.source_domain,
        data_mode: raw.data_mode ?? contribution.data_mode,
        observed_at: raw.observed_at ?? contribution.observed_at,
        ...(raw.expires_at || contribution.expires_at
          ? { expires_at: raw.expires_at ?? contribution.expires_at }
          : {}),
      };
      const existing = glanceById.get(item.id);
      glanceById.set(item.id, existing ? chooseGlance(existing, item) : item);
    }

    for (const item of contribution.items ?? []) {
      const existing = itemById.get(item.id);
      itemById.set(item.id, existing ? chooseItem(existing, item) : item);
    }
  }

  const locality = current.find((item) => item.locality_label)?.locality_label;

  return {
    generated_at: now.toISOString(),
    ...(locality ? { locality_label: locality } : {}),
    glance: [...glanceById.values()].slice(0, maxGlance),
    source_state: contributions.map((item) => ({
      source_domain: item.source_domain,
      data_mode: item.data_mode,
      observed_at: item.observed_at,
      ...(item.expires_at ? { expires_at: item.expires_at } : {}),
      ...(item.message ? { message: item.message } : {}),
    })),
    items: [...itemById.values()],
  };
}
