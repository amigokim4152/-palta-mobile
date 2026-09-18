import type { MarketCategoryKey } from './marketCatalog.js';
import type { MarketVerticalKey } from './marketVerticalPolicy.js';

export type MarketInterestAction =
  | 'view'
  | 'favorite'
  | 'compare'
  | 'message'
  | 'search';

export type MarketInterestSignal = {
  action: MarketInterestAction;
  occurredAt: string;
  vertical: MarketVerticalKey;
  category?: Exclude<MarketCategoryKey, 'all'>;
  /** Language-neutral taxonomy key when a classifier/catalog already knows it. */
  productFamilyKey?: string;
  /** Listing id is optional so normalized search interest can be recorded too. */
  listingId?: string;
  /** Coarse CLP band only; recommendation history does not need an exact price. */
  priceBand?: MarketPriceBand;
};

export type MarketPriceBand =
  | 'under_50k'
  | '50k_150k'
  | '150k_400k'
  | '400k_800k'
  | '800k_plus';

export type MarketInterestProfile = {
  verticalWeights: Partial<Record<MarketVerticalKey, number>>;
  categoryWeights: Partial<Record<Exclude<MarketCategoryKey, 'all'>, number>>;
  productFamilyWeights: Record<string, number>;
  priceBandWeights: Partial<Record<MarketPriceBand, number>>;
  signalCount: number;
};

export const MARKET_INTEREST_RETENTION_DAYS = 30;
export const MARKET_INTEREST_MAX_SIGNALS = 100;

const ACTION_WEIGHT: Record<MarketInterestAction, number> = {
  view: 1,
  search: 1,
  compare: 2,
  favorite: 3,
  message: 4,
};

export function marketPriceBand(priceClp: number | undefined): MarketPriceBand | undefined {
  if (typeof priceClp !== 'number' || !Number.isFinite(priceClp) || priceClp < 0) {
    return undefined;
  }
  if (priceClp < 50_000) return 'under_50k';
  if (priceClp < 150_000) return '50k_150k';
  if (priceClp < 400_000) return '150k_400k';
  if (priceClp < 800_000) return '400k_800k';
  return '800k_plus';
}

/**
 * Keeps only a short, bounded recommendation history. Exact seller location,
 * address, phone/email, raw auth ids and message contents are deliberately not
 * representable by this contract.
 */
export function retainMarketInterestSignals(
  signals: readonly MarketInterestSignal[],
  nowMs = Date.now(),
): MarketInterestSignal[] {
  const cutoff = nowMs - MARKET_INTEREST_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return signals
    .filter((signal) => {
      const time = Date.parse(signal.occurredAt);
      return Number.isFinite(time) && time >= cutoff && time <= nowMs + 60_000;
    })
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, MARKET_INTEREST_MAX_SIGNALS);
}

/**
 * Builds a compact preference profile without preserving raw search text or
 * exact location. Recent intent naturally wins because callers feed the bounded
 * retained signal window and stronger actions (favorite/message) weigh more.
 */
export function buildMarketInterestProfile(
  signals: readonly MarketInterestSignal[],
  nowMs = Date.now(),
): MarketInterestProfile {
  const retained = retainMarketInterestSignals(signals, nowMs);
  const profile: MarketInterestProfile = {
    verticalWeights: {},
    categoryWeights: {},
    productFamilyWeights: {},
    priceBandWeights: {},
    signalCount: retained.length,
  };

  for (const signal of retained) {
    const baseWeight = ACTION_WEIGHT[signal.action];
    const ageDays = Math.max(0, (nowMs - Date.parse(signal.occurredAt)) / 86_400_000);
    const recencyWeight = Math.max(0.25, 1 - ageDays / MARKET_INTEREST_RETENTION_DAYS);
    const weight = Math.round(baseWeight * recencyWeight * 100) / 100;

    profile.verticalWeights[signal.vertical] =
      (profile.verticalWeights[signal.vertical] ?? 0) + weight;

    if (signal.category) {
      profile.categoryWeights[signal.category] =
        (profile.categoryWeights[signal.category] ?? 0) + weight;
    }
    if (signal.productFamilyKey) {
      profile.productFamilyWeights[signal.productFamilyKey] =
        (profile.productFamilyWeights[signal.productFamilyKey] ?? 0) + weight;
    }
    if (signal.priceBand) {
      profile.priceBandWeights[signal.priceBand] =
        (profile.priceBandWeights[signal.priceBand] ?? 0) + weight;
    }
  }

  return profile;
}