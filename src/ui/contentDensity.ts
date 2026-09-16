export type HomeDensityInput = {
  actionCount: number;
  statusCount: number;
  usefulTodayCount: number;
  discoveryCount: number;
};

export type HomeDensityDecision = {
  maxDiscoveryCards: number;
  showQuietEndState: boolean;
};

export function decideHomeDensity(
  input: HomeDensityInput,
): HomeDensityDecision {
  const workCount =
    input.actionCount + input.statusCount + input.usefulTodayCount;

  if (workCount >= 6) {
    return { maxDiscoveryCards: 0, showQuietEndState: false };
  }

  if (workCount >= 3) {
    return {
      maxDiscoveryCards: Math.min(1, input.discoveryCount),
      showQuietEndState: false,
    };
  }

  const room = Math.max(0, 3 - workCount);
  const maxDiscoveryCards = Math.min(room, input.discoveryCount, 2);

  return {
    maxDiscoveryCards,
    showQuietEndState: workCount + maxDiscoveryCards <= 2,
  };
}
