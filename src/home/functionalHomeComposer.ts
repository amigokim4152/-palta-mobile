import {
  canRenderHomeFunctionalItem,
  validateHomeFunctionalPayload,
  type HomeContext,
  type HomeFunctionalItem,
  type HomeFunctionalPayload,
  type HomeGlanceSignal,
} from './homeFunctionalContract.js';
import { canRenderGlanceSignal } from './homeCachePolicy.js';
import {
  homeBehaviorPriorityAdjustment,
  isHomeItemExplicitlySuppressed,
  type HomeBehaviorProfile,
} from './homeBehaviorProfile.js';

export type HomeFunctionalContribution = {
  glance?: readonly HomeGlanceSignal[];
  items?: readonly HomeFunctionalItem[];
};

export type ComposeFunctionalHomeOptions = {
  now?: Date;
  maxGlance?: number;
  maxNow?: number;
  maxInProgress?: number;
  maxUpcoming?: number;
  maxUsefulToday?: number;
  behaviorProfile?: HomeBehaviorProfile;
};

const SURFACE_WEIGHT: Record<HomeFunctionalItem['surface'], number> = {
  now: 8,
  in_progress: 5,
  upcoming: 4,
  useful_today: 2,
};

const KIND_WEIGHT: Record<HomeFunctionalItem['kind'], number> = {
  alert: 3.5,
  action: 3,
  status: 2,
  useful: 1.5,
  content: 0.5,
};

function score(
  item: HomeFunctionalItem,
  behaviorProfile: HomeBehaviorProfile | undefined,
): number {
  return (
    SURFACE_WEIGHT[item.surface] +
    KIND_WEIGHT[item.kind] +
    (item.personalized ? 1 : 0) +
    (item.urgency ?? 0) * 1.2 +
    (item.importance ?? 0) +
    (item.relevance ?? 0) * 2 +
    homeBehaviorPriorityAdjustment(item, behaviorProfile)
  );
}

function chooseBetter(
  a: HomeFunctionalItem,
  b: HomeFunctionalItem,
  behaviorProfile: HomeBehaviorProfile | undefined,
): HomeFunctionalItem {
  const aScore = score(a, behaviorProfile);
  const bScore = score(b, behaviorProfile);
  if (aScore !== bScore) return aScore > bScore ? a : b;

  const aObserved = Date.parse(a.source.observedAt ?? '');
  const bObserved = Date.parse(b.source.observedAt ?? '');
  if (Number.isFinite(aObserved) && Number.isFinite(bObserved) && aObserved !== bObserved) {
    return aObserved > bObserved ? a : b;
  }
  return a;
}

function dedupe(
  items: readonly HomeFunctionalItem[],
  behaviorProfile: HomeBehaviorProfile | undefined,
): HomeFunctionalItem[] {
  const byKey = new Map<string, HomeFunctionalItem>();
  for (const item of items) {
    const key = item.dedupeKey?.trim() || item.id;
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing ? chooseBetter(existing, item, behaviorProfile) : item,
    );
  }
  return [...byKey.values()];
}

function scoreDescending(
  a: HomeFunctionalItem,
  b: HomeFunctionalItem,
  behaviorProfile: HomeBehaviorProfile | undefined,
): number {
  const difference = score(b, behaviorProfile) - score(a, behaviorProfile);
  if (difference !== 0) return difference;
  return a.id.localeCompare(b.id);
}

function upcomingAscending(
  a: HomeFunctionalItem,
  b: HomeFunctionalItem,
  behaviorProfile: HomeBehaviorProfile | undefined,
): number {
  const aTime = Date.parse(a.scheduledAt ?? '');
  const bTime = Date.parse(b.scheduledAt ?? '');
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return aTime - bTime;
  }
  return scoreDescending(a, b, behaviorProfile);
}

function composeGlance(
  signals: readonly HomeGlanceSignal[],
  now: Date,
  maxGlance: number,
): HomeGlanceSignal[] {
  const byId = new Map<string, HomeGlanceSignal>();
  for (const signal of signals) {
    if (!canRenderGlanceSignal(signal, now)) continue;
    const existing = byId.get(signal.id);
    if (!existing) {
      byId.set(signal.id, signal);
      continue;
    }

    const existingObserved = Date.parse(existing.source.observedAt ?? '');
    const nextObserved = Date.parse(signal.source.observedAt ?? '');
    if (
      (!Number.isFinite(existingObserved) && Number.isFinite(nextObserved)) ||
      (Number.isFinite(existingObserved) &&
        Number.isFinite(nextObserved) &&
        nextObserved > existingObserved)
    ) {
      byId.set(signal.id, signal);
    }
  }

  return [...byId.values()]
    .sort((a, b) => {
      if (Boolean(a.exceptional) !== Boolean(b.exceptional)) {
        return a.exceptional ? -1 : 1;
      }
      const relevance = (b.relevance ?? 0) - (a.relevance ?? 0);
      if (relevance !== 0) return relevance;
      return a.id.localeCompare(b.id);
    })
    .slice(0, Math.max(0, maxGlance));
}

/**
 * Central function-first Home composition.
 *
 * Domain adapters decide whether a fact is Home-worthy and which semantic
 * surface it belongs to. This composer only performs cross-domain concerns:
 * validation, expiry filtering, dedupe, ordering and density control.
 * Privacy-minimized explicit behavior aggregates may fine-tune ordering, but
 * never replace semantic urgency/importance or suppress required state.
 */
export function composeFunctionalHome(input: {
  generatedAt: string;
  context: HomeContext;
  contributions: readonly HomeFunctionalContribution[];
  options?: ComposeFunctionalHomeOptions;
}): HomeFunctionalPayload {
  const now = input.options?.now ?? new Date();
  const maxGlance = input.options?.maxGlance ?? 4;
  const maxNow = input.options?.maxNow ?? 3;
  const maxInProgress = input.options?.maxInProgress ?? 4;
  const maxUpcoming = input.options?.maxUpcoming ?? 5;
  const maxUsefulToday = input.options?.maxUsefulToday ?? 4;
  const behaviorProfile = input.options?.behaviorProfile;

  const glance = composeGlance(
    input.contributions.flatMap((contribution) => contribution.glance ?? []),
    now,
    maxGlance,
  );

  const admitted = dedupe(
    input.contributions
      .flatMap((contribution) => contribution.items ?? [])
      .filter((item) => canRenderHomeFunctionalItem(item, now))
      .filter((item) => !isHomeItemExplicitlySuppressed(item, behaviorProfile)),
    behaviorProfile,
  );

  const nowItems = admitted
    .filter((item) => item.surface === 'now')
    .sort((a, b) => scoreDescending(a, b, behaviorProfile))
    .slice(0, Math.max(0, maxNow));

  const inProgress = admitted
    .filter((item) => item.surface === 'in_progress')
    .sort((a, b) => scoreDescending(a, b, behaviorProfile))
    .slice(0, Math.max(0, maxInProgress));

  const upcoming = admitted
    .filter((item) => item.surface === 'upcoming')
    .sort((a, b) => upcomingAscending(a, b, behaviorProfile))
    .slice(0, Math.max(0, maxUpcoming));

  const activeLoad = nowItems.length + inProgress.length + upcoming.length;
  const usefulCandidates = admitted
    .filter((item) => item.surface === 'useful_today')
    .sort((a, b) => scoreDescending(a, b, behaviorProfile));

  // Useful operational/public-life information may remain when Home is busy,
  // but generic content/news is reduced first. This prevents engagement filler.
  const contentCap = activeLoad >= 8 ? 0 : activeLoad >= 5 ? 1 : 3;
  let admittedContent = 0;
  const usefulToday: HomeFunctionalItem[] = [];
  for (const item of usefulCandidates) {
    if (usefulToday.length >= Math.max(0, maxUsefulToday)) break;
    if (item.kind === 'content') {
      if (admittedContent >= contentCap) continue;
      admittedContent += 1;
    }
    usefulToday.push(item);
  }

  const payload: HomeFunctionalPayload = {
    generatedAt: input.generatedAt,
    context: input.context,
    glance,
    now: nowItems,
    inProgress,
    upcoming,
    usefulToday,
    ...(activeLoad === 0
      ? { quietState: { title: 'Nada urgente por ahora' } }
      : {}),
  };

  const errors = validateHomeFunctionalPayload(payload);
  if (errors.length > 0) {
    throw new Error(`Functional Home composition produced invalid payload: ${errors.join('; ')}`);
  }

  return payload;
}
