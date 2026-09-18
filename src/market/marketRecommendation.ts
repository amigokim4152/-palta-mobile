import type { MarketCategoryKey, MarketTradeMode } from './marketCatalog.js';
import type { MarketListingStatus } from './marketLifecycle.js';
import type { MarketVerticalKey } from './marketVerticalPolicy.js';

export type MarketRecommendationReason =
  | 'same_product_family'
  | 'same_category'
  | 'similar_price'
  | 'nearby'
  | 'same_trade_mode'
  | 'available_now';

/**
 * Recommendation projection deliberately contains only discovery-safe fields.
 * Product family is supplied by a language-neutral taxonomy/classifier outside
 * Mercado persistence; it is not inferred here from localized listing copy.
 */
export type MarketRecommendationCandidate = {
  listingId: string;
  vertical: MarketVerticalKey;
  category: Exclude<MarketCategoryKey, 'all'>;
  tradeMode: MarketTradeMode;
  status: MarketListingStatus;
  productFamilyKey?: string;
  priceClp?: number;
  distanceKm?: number;
};

export type RankedMarketRecommendation = {
  listingId: string;
  score: number;
  reasons: MarketRecommendationReason[];
};

const RECOMMENDABLE_STATUSES = new Set<MarketListingStatus>(['active', 'reserved']);

function priceSimilarityScore(seedPrice: number | undefined, candidatePrice: number | undefined) {
  if (
    typeof seedPrice !== 'number' ||
    typeof candidatePrice !== 'number' ||
    seedPrice <= 0 ||
    candidatePrice < 0
  ) {
    return 0;
  }
  const relativeGap = Math.abs(candidatePrice - seedPrice) / seedPrice;
  return Math.max(0, 24 * (1 - Math.min(relativeGap, 1)));
}

function nearbyScore(distanceKm: number | undefined) {
  if (typeof distanceKm !== 'number' || distanceKm < 0) return 0;
  return Math.max(0, 14 * (1 - Math.min(distanceKm / 25, 1)));
}

/**
 * Zero-paid-AI recommendation baseline.
 *
 * The scorer intentionally favors semantic relevance before popularity:
 * product family -> category -> price similarity -> distance. This avoids a
 * generic "popular items" rail and keeps smartphone browsing focused on
 * smartphones, while still allowing a fallback inside the same category.
 */
export function rankMarketRecommendations(input: {
  seed: MarketRecommendationCandidate;
  candidates: MarketRecommendationCandidate[];
  limit?: number;
}): RankedMarketRecommendation[] {
  const limit = Math.max(0, Math.min(input.limit ?? 4, 20));
  if (limit === 0) return [];

  return input.candidates
    .filter(
      (candidate) =>
        candidate.listingId !== input.seed.listingId &&
        candidate.vertical === input.seed.vertical &&
        RECOMMENDABLE_STATUSES.has(candidate.status),
    )
    .map((candidate) => {
      let score = 0;
      const reasons: MarketRecommendationReason[] = [];

      if (
        input.seed.productFamilyKey &&
        candidate.productFamilyKey === input.seed.productFamilyKey
      ) {
        score += 70;
        reasons.push('same_product_family');
      }

      if (candidate.category === input.seed.category) {
        score += 25;
        reasons.push('same_category');
      }

      if (candidate.tradeMode === input.seed.tradeMode) {
        score += 8;
        reasons.push('same_trade_mode');
      }

      const priceScore = priceSimilarityScore(input.seed.priceClp, candidate.priceClp);
      if (priceScore >= 8) reasons.push('similar_price');
      score += priceScore;

      const distanceScore = nearbyScore(candidate.distanceKm);
      if (distanceScore >= 7) reasons.push('nearby');
      score += distanceScore;

      if (candidate.status === 'active') {
        score += 6;
        reasons.push('available_now');
      }

      // Recommendations must retain at least categorical relevance. A nearby
      // but unrelated item must never appear merely because distance is small.
      const relevant =
        reasons.includes('same_product_family') || reasons.includes('same_category');

      return {
        listingId: candidate.listingId,
        score: relevant ? Math.round(score * 100) / 100 : -1,
        reasons,
      } satisfies RankedMarketRecommendation;
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.listingId.localeCompare(b.listingId))
    .slice(0, limit);
}
