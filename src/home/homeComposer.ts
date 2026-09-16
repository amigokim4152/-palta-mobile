import type {
  HomeCandidate,
  HomeCard,
  HomeComposition,
} from '../core/contracts.js';
import { resolveDelivery } from '../notification/deliveryPolicy.js';

export interface HomeComposerOptions {
  now?: Date;
  maxPrimary?: number;
  maxSecondaryWhenBusy?: number;
  maxSecondaryWhenLight?: number;
  maxSecondaryWhenEmpty?: number;
  minimumSecondaryScore?: number;
}

const DEFAULTS: Required<Omit<HomeComposerOptions, 'now'>> = {
  maxPrimary: 8,
  maxSecondaryWhenBusy: 1,
  maxSecondaryWhenLight: 3,
  maxSecondaryWhenEmpty: 4,
  minimumSecondaryScore: 3.1,
};

function asTime(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isActive(candidate: HomeCandidate, nowMs: number): boolean {
  const from = asTime(candidate.validFrom);
  const until = asTime(candidate.validUntil);
  if (from !== undefined && from > nowMs) return false;
  if (until !== undefined && until < nowMs) return false;
  if (candidate.freshness === 'stale' && candidate.kind !== 'status') return false;
  return true;
}

function baseScore(candidate: HomeCandidate): number {
  const kindWeight: Record<HomeCandidate['kind'], number> = {
    alert: 3.4,
    action: 3.0,
    status: 2.5,
    info: 1.4,
    content: 1.0,
  };
  const confidenceWeight =
    candidate.confidence === 'confirmed' ? 0.5 :
    candidate.confidence === 'corroborated' ? 0.3 :
    candidate.confidence === 'inferred' ? -0.25 : -0.5;

  return (
    kindWeight[candidate.kind] +
    candidate.urgency * 0.9 +
    candidate.importance * 0.65 +
    Math.max(0, Math.min(1, candidate.relevance)) * 2 +
    (candidate.actionRequired ? 0.9 : 0) +
    (candidate.waitingState ? 0.25 : 0) +
    confidenceWeight
  );
}

function chooseBetter(a: HomeCandidate, b: HomeCandidate): HomeCandidate {
  return baseScore(a) >= baseScore(b) ? a : b;
}

function dedupe(candidates: HomeCandidate[]): HomeCandidate[] {
  const map = new Map<string, HomeCandidate>();
  for (const candidate of candidates) {
    const existing = map.get(candidate.dedupeKey);
    map.set(candidate.dedupeKey, existing ? chooseBetter(existing, candidate) : candidate);
  }
  return [...map.values()];
}

function cluster(cards: HomeCard[]): HomeCard[] {
  const result: HomeCard[] = [];
  const byCluster = new Map<string, HomeCard[]>();

  for (const card of cards) {
    if (!card.clusterKey) {
      result.push(card);
      continue;
    }
    const group = byCluster.get(card.clusterKey) ?? [];
    group.push(card);
    byCluster.set(card.clusterKey, group);
  }

  for (const group of byCluster.values()) {
    group.sort((a, b) => b.score - a.score);
    const head = group[0];
    if (!head) continue;
    result.push({
      ...head,
      relatedCandidateIds: group.slice(1).map((item) => item.id),
    });
  }

  return result.sort((a, b) => b.score - a.score);
}

function toCard(candidate: HomeCandidate): HomeCard {
  return {
    ...candidate,
    score: baseScore(candidate),
    delivery: resolveDelivery(candidate),
    relatedCandidateIds: [],
  };
}

export function composeHome(
  rawCandidates: HomeCandidate[],
  options: HomeComposerOptions = {},
): HomeComposition {
  const now = options.now ?? new Date();
  const cfg = { ...DEFAULTS, ...options };

  const active = dedupe(rawCandidates.filter((item) => isActive(item, now.getTime())))
    .map(toCard)
    .filter((card) => card.delivery !== 'ignore');

  const clustered = cluster(active);
  const primaryPool = clustered.filter(
    (card) => card.kind === 'action' || card.kind === 'status' || card.kind === 'alert',
  );
  const secondaryPool = clustered.filter(
    (card) => card.kind === 'info' || card.kind === 'content',
  );

  const primary = primaryPool.slice(0, cfg.maxPrimary);

  // No fixed slot count: secondary content is admitted only when useful enough.
  // Sparse primary cards allow more useful news/local/weather content, but we never
  // add low-value cards merely to make the Home look full.
  const secondaryLimit =
    primary.length === 0
      ? cfg.maxSecondaryWhenEmpty
      : primary.length <= 3
        ? cfg.maxSecondaryWhenLight
        : cfg.maxSecondaryWhenBusy;

  const secondary = secondaryPool
    .filter((card) => card.score >= cfg.minimumSecondaryScore)
    .slice(0, secondaryLimit);

  return {
    primary,
    secondary,
    all: [...primary, ...secondary],
    generatedAt: now.toISOString(),
  };
}
