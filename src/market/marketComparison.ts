import type { MarketId } from './marketPersistenceContract.js';
import type { MarketVerticalKey } from './marketVerticalPolicy.js';

export const MARKET_COMPARISON_LIMIT = 4;

export type MarketComparisonCandidate = {
  listingId: MarketId;
  vertical: MarketVerticalKey;
};

export type MarketComparisonSelection = {
  vertical?: MarketVerticalKey;
  listingIds: readonly MarketId[];
};

export type MarketComparisonToggleResult = {
  selection: MarketComparisonSelection;
  outcome: 'added' | 'removed' | 'limit_reached' | 'vertical_mismatch';
};

export const EMPTY_MARKET_COMPARISON: MarketComparisonSelection = {
  listingIds: [],
};

/**
 * Comparison stores canonical listing ids only. It never copies listing,
 * seller, Business, contact or location payloads into comparison state.
 */
export function toggleMarketComparison(
  selection: MarketComparisonSelection,
  candidate: MarketComparisonCandidate,
): MarketComparisonToggleResult {
  if (selection.listingIds.includes(candidate.listingId)) {
    const listingIds = selection.listingIds.filter((id) => id !== candidate.listingId);
    return {
      selection: {
        ...(listingIds.length > 0 && selection.vertical
          ? { vertical: selection.vertical }
          : {}),
        listingIds,
      },
      outcome: 'removed',
    };
  }

  if (selection.vertical && selection.vertical !== candidate.vertical) {
    return { selection, outcome: 'vertical_mismatch' };
  }

  if (selection.listingIds.length >= MARKET_COMPARISON_LIMIT) {
    return { selection, outcome: 'limit_reached' };
  }

  return {
    selection: {
      vertical: selection.vertical ?? candidate.vertical,
      listingIds: [...selection.listingIds, candidate.listingId],
    },
    outcome: 'added',
  };
}
