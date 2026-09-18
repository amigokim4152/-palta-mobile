import {
  schoolStructuredItemDedupeKey,
  validateSchoolStructuredContentDraft,
} from '../src/community/schoolStructuredContent.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  validateSchoolStructuredContentDraft({
    postId: 'post-schedule',
    stage: 'schedule',
    title: 'Reunión de apoderados',
    detail: 'Martes 18:30',
    actionRequired: false,
    sensitive: false,
    dueAt: '2026-09-22T18:30:00-03:00',
  }).ok,
  'A non-sensitive schedule item should be valid.',
);

assert(
  !validateSchoolStructuredContentDraft({
    postId: 'post-child',
    stage: 'child_notice',
    title: 'Autorización pendiente',
    detail: 'Revisión familiar',
    actionRequired: true,
    sensitive: true,
  }).ok,
  'Sensitive child notices must have an explicit recipient.',
);

const publicChildNotice = validateSchoolStructuredContentDraft({
  postId: 'post-child',
  stage: 'child_notice',
  title: 'Autorización pendiente',
  detail: 'Revisión familiar',
  actionRequired: true,
  sensitive: false,
  recipientUserId: 'guardian-user',
});
assert(
  !publicChildNotice.ok && publicChildNotice.code === 'SCHOOL_ITEM_CHILD_NOTICE_MUST_BE_PRIVATE',
  'Child notices must always remain private.',
);

const invalidDate = validateSchoolStructuredContentDraft({
  postId: 'post-supplies',
  stage: 'supplies',
  title: 'Materiales',
  detail: 'Cuaderno de ciencias',
  actionRequired: true,
  sensitive: false,
  dueAt: 'not-a-date',
});
assert(
  !invalidDate.ok && invalidDate.code === 'SCHOOL_ITEM_INVALID_DUE_AT',
  'Invalid due dates must fail closed.',
);

assert(
  schoolStructuredItemDedupeKey({
    communitySpaceId: 'space-1',
    postId: 'post-1',
    stage: 'supplies',
  }) === 'community-school-item:space-1:post-1:supplies:group',
  'Group structured item dedupe keys must be stable.',
);
assert(
  schoolStructuredItemDedupeKey({
    communitySpaceId: 'space-1',
    postId: 'post-1',
    stage: 'child_notice',
    recipientUserId: 'guardian-1',
  }) === 'community-school-item:space-1:post-1:child_notice:guardian-1',
  'Private child items must dedupe per recipient.',
);

console.log('PASS: school structured content tests');
