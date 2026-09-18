import type {
  HomeCorrectionReason,
  HomeFunctionalItem,
} from './homeFunctionalContract.js';

export type HomeCorrectionEffect =
  | 'hide_item'
  | 'recheck_subject_relationship'
  | 'reconcile_domain_completion'
  | 'report_source_issue'
  | 'suppress_item_type';

export type HomeCorrectionIntent = {
  id: string;
  itemId: string;
  reason: HomeCorrectionReason;
  effect: HomeCorrectionEffect;
  createdAt: string;
  sourceDomain: string;
  subjectId?: string;
};

export function effectForHomeCorrection(
  reason: HomeCorrectionReason,
): HomeCorrectionEffect {
  switch (reason) {
    case 'not_relevant':
      return 'hide_item';
    case 'wrong_subject':
      return 'recheck_subject_relationship';
    case 'already_done':
      return 'reconcile_domain_completion';
    case 'incorrect_information':
      return 'report_source_issue';
    case 'hide_type':
      return 'suppress_item_type';
  }
}

export function createHomeCorrectionIntent(input: {
  item: HomeFunctionalItem;
  reason: HomeCorrectionReason;
  now?: Date;
  intentId?: string;
}): HomeCorrectionIntent {
  if (!input.item.corrections?.includes(input.reason)) {
    throw new Error(`Correction ${input.reason} is not allowed for ${input.item.id}`);
  }

  const createdAt = (input.now ?? new Date()).toISOString();
  const intent: HomeCorrectionIntent = {
    id: input.intentId ?? `home-correction:${input.item.id}:${input.reason}:${createdAt}`,
    itemId: input.item.id,
    reason: input.reason,
    effect: effectForHomeCorrection(input.reason),
    createdAt,
    sourceDomain: input.item.source.domain,
  };

  if (input.item.subject?.id) intent.subjectId = input.item.subject.id;
  return intent;
}

/**
 * A correction is feedback/intent first. Only not-relevant and hide-type can
 * immediately suppress presentation. Domain completion and relationship
 * corrections must be reconciled by their owning core before becoming facts.
 */
export function shouldSuppressImmediately(intent: HomeCorrectionIntent): boolean {
  return intent.effect === 'hide_item' || intent.effect === 'suppress_item_type';
}
