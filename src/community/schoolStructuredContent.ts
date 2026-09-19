import type { SchoolFlowStage } from './communityExperience.js';

export type SchoolStructuredContentDraft = {
  postId: string;
  stage: SchoolFlowStage;
  title: string;
  detail: string;
  actionRequired: boolean;
  sensitive: boolean;
  dueAt?: string;
  recipientUserId?: string;
};

export type SchoolStructuredContentValidation =
  | { ok: true }
  | { ok: false; code: string };

function validDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export function validateSchoolStructuredContentDraft(
  draft: SchoolStructuredContentDraft,
): SchoolStructuredContentValidation {
  if (!draft.postId.trim()) return { ok: false, code: 'SCHOOL_ITEM_POST_REQUIRED' };
  if (!draft.title.trim()) return { ok: false, code: 'SCHOOL_ITEM_TITLE_REQUIRED' };
  if (!draft.detail.trim()) return { ok: false, code: 'SCHOOL_ITEM_DETAIL_REQUIRED' };
  if (draft.dueAt && !validDate(draft.dueAt)) {
    return { ok: false, code: 'SCHOOL_ITEM_INVALID_DUE_AT' };
  }
  if (draft.sensitive && !draft.recipientUserId?.trim()) {
    return { ok: false, code: 'SCHOOL_ITEM_PRIVATE_RECIPIENT_REQUIRED' };
  }
  if (draft.stage === 'child_notice' && !draft.sensitive) {
    return { ok: false, code: 'SCHOOL_ITEM_CHILD_NOTICE_MUST_BE_PRIVATE' };
  }
  return { ok: true };
}

export function schoolStructuredItemDedupeKey(input: {
  communitySpaceId: string;
  postId: string;
  stage: SchoolFlowStage;
  recipientUserId?: string;
}): string {
  return [
    'community-school-item',
    input.communitySpaceId,
    input.postId,
    input.stage,
    input.recipientUserId?.trim() || 'group',
  ].join(':');
}
