import type { HomeApiItem } from '../api/paltaApiClient.js';
import { decideHomeDensity } from '../ui/contentDensity.js';

function zoneRank(item: HomeApiItem): number {
  switch (item.kind) {
    case 'alert':
    case 'action':
      return 0;
    case 'status':
      return 1;
    case 'useful_today':
      return 2;
    case 'content':
      return 3;
  }
}

export type HomeDisplaySelection = {
  items: HomeApiItem[];
  showQuietEndState: boolean;
};

export function selectHomeDisplayItems(
  input: readonly HomeApiItem[],
): HomeDisplaySelection {
  const actionCount = input.filter(
    (item) => item.kind === 'action' || item.kind === 'alert',
  ).length;
  const statusCount = input.filter((item) => item.kind === 'status').length;
  const usefulTodayCount = input.filter(
    (item) => item.kind === 'useful_today',
  ).length;
  const discovery = input.filter((item) => item.kind === 'content');

  const density = decideHomeDensity({
    actionCount,
    statusCount,
    usefulTodayCount,
    discoveryCount: discovery.length,
  });

  let discoveryUsed = 0;
  const sorted = [...input].sort((a, b) => zoneRank(a) - zoneRank(b));

  const items = sorted.filter((item) => {
    if (item.kind !== 'content') return true;
    if (discoveryUsed >= density.maxDiscoveryCards) return false;
    discoveryUsed += 1;
    return true;
  });

  return {
    items,
    showQuietEndState: density.showQuietEndState,
  };
}
