import { resolveDelivery } from '../src/notification/deliveryPolicy.js';
import {
  projectCommunitySchoolItemToHomeCandidate,
  projectCommunitySchoolItemToNotificationEvent,
  shouldPublishCommunityNotificationCandidate,
  type CommunitySchoolItemEvent,
} from '../src/community/communityHomeProjection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-18T18:00:00-03:00');

function baseInput(overrides: Partial<CommunitySchoolItemEvent> = {}): CommunitySchoolItemEvent {
  return {
    outboxId: 'outbox-1',
    occurredAt: '2026-09-18T17:55:00-03:00',
    spaceId: 'school-space-1',
    spaceName: 'Colegio Palta',
    item: {
      id: 'item-1',
      postId: 'post-1',
      stage: 'announcement',
      title: 'Aviso escolar',
      detail: 'Información para las familias',
      actionRequired: false,
      sensitive: false,
    },
    recipient: {
      userId: 'guardian-1',
      membershipActive: true,
      relationshipActive: true,
      notificationsEnabled: true,
    },
    ...overrides,
  };
}

const announcement = projectCommunitySchoolItemToHomeCandidate(baseInput(), now);
assert(announcement, 'Active school members should receive group announcements in Home.');
assert(announcement.kind === 'info', 'Announcements should stay informational.');
assert(resolveDelivery(announcement) === 'home', 'Announcements must remain Home-only.');
assert(
  !shouldPublishCommunityNotificationCandidate(baseInput(), announcement),
  'Announcements must not create engagement pushes by default.',
);

const nearScheduleInput = baseInput({
  item: {
    id: 'schedule-1',
    postId: 'post-schedule',
    stage: 'schedule',
    title: 'Reunión de apoderados',
    detail: 'Hoy 19:00',
    actionRequired: false,
    sensitive: false,
    dueAt: '2026-09-18T19:00:00-03:00',
  },
});
const nearSchedule = projectCommunitySchoolItemToHomeCandidate(nearScheduleInput, now);
assert(nearSchedule, 'Schedule content should project to Home.');
assert(nearSchedule.kind === 'info', 'Schedules should remain informational, even when near.');
assert(resolveDelivery(nearSchedule) === 'home', 'Near schedules must not become push by proximity alone.');

const suppliesInput = baseInput({
  item: {
    id: 'supplies-1',
    postId: 'post-supplies',
    stage: 'supplies',
    title: 'Preparar materiales',
    detail: 'Cuaderno y botella de agua',
    actionRequired: true,
    sensitive: false,
    dueAt: '2026-09-19T12:00:00-03:00',
  },
});
const supplies = projectCommunitySchoolItemToHomeCandidate(suppliesInput, now);
assert(supplies, 'Required supplies should project to Home.');
assert(supplies.kind === 'action', 'Required supplies should be an action candidate.');
assert(supplies.urgency === 3, 'Supplies due within 48 hours should reach urgency 3.');
assert(resolveDelivery(supplies) === 'home_notify', 'Near required supplies should qualify for home_notify.');
assert(
  shouldPublishCommunityNotificationCandidate(suppliesInput, supplies),
  'Near required supplies may publish a notification candidate when notifications are enabled.',
);

const laterSuppliesInput = baseInput({
  item: {
    id: 'supplies-later',
    postId: 'post-supplies-later',
    stage: 'supplies',
    title: 'Materiales para la próxima semana',
    detail: 'Preparar con anticipación',
    actionRequired: true,
    sensitive: false,
    dueAt: '2026-09-28T12:00:00-03:00',
  },
});
const laterSupplies = projectCommunitySchoolItemToHomeCandidate(laterSuppliesInput, now);
assert(laterSupplies, 'Later supplies should still appear in Home.');
assert(resolveDelivery(laterSupplies) === 'home', 'Far-future supplies should not notify yet.');
assert(
  !shouldPublishCommunityNotificationCandidate(laterSuppliesInput, laterSupplies),
  'Far-future supplies should not create a push candidate.',
);

const overdueInput = baseInput({
  item: {
    id: 'overdue-1',
    postId: 'post-overdue',
    stage: 'supplies',
    title: 'Material pendiente',
    detail: 'Aún requiere confirmación',
    actionRequired: true,
    sensitive: false,
    dueAt: '2026-09-17T12:00:00-03:00',
  },
});
const overdue = projectCommunitySchoolItemToHomeCandidate(overdueInput, now);
assert(overdue, 'Overdue unresolved actions should remain visible.');
assert(overdue.urgency === 4, 'Overdue unresolved actions should be urgency 4.');
assert(overdue.validUntil === undefined, 'Overdue action items must not expire merely because dueAt passed.');
assert(resolveDelivery(overdue) === 'home_notify', 'Overdue school actions should notify, but not become urgent automatically.');

const childInput = baseInput({
  item: {
    id: 'child-1',
    postId: 'post-child',
    stage: 'child_notice',
    title: 'Autorización pendiente',
    detail: 'Revisar autorización del estudiante',
    actionRequired: true,
    sensitive: true,
    recipientUserId: 'guardian-1',
    dueAt: '2026-09-19T10:00:00-03:00',
  },
});
const child = projectCommunitySchoolItemToHomeCandidate(childInput, now);
assert(child, 'Recipient-scoped child notice should project for the matching guardian.');
assert(child.relevance === 1, 'Direct child notices should have maximum relation relevance.');
assert(resolveDelivery(child) === 'home_notify', 'Near child actions may notify the authorized guardian.');

const wrongRecipient = projectCommunitySchoolItemToHomeCandidate({
  ...childInput,
  recipient: { ...childInput.recipient, userId: 'guardian-2' },
}, now);
assert(wrongRecipient === null, 'Child notices must never project to a different guardian.');

const endedRelationship = projectCommunitySchoolItemToHomeCandidate({
  ...suppliesInput,
  recipient: { ...suppliesInput.recipient, relationshipActive: false },
}, now);
assert(endedRelationship === null, 'Ended school relationships must fail closed.');

const sensitiveWithoutRecipient = projectCommunitySchoolItemToHomeCandidate(baseInput({
  item: {
    id: 'bad-sensitive',
    postId: 'post-bad',
    stage: 'announcement',
    title: 'Privado',
    detail: 'No debe proyectarse',
    actionRequired: false,
    sensitive: true,
  },
}), now);
assert(sensitiveWithoutRecipient === null, 'Sensitive group content without a recipient must fail closed.');

const notificationsOffInput = {
  ...suppliesInput,
  recipient: { ...suppliesInput.recipient, notificationsEnabled: false },
};
const notificationsOffCandidate = projectCommunitySchoolItemToHomeCandidate(notificationsOffInput, now);
assert(notificationsOffCandidate, 'Disabling push must not remove a useful Home card.');
assert(
  !shouldPublishCommunityNotificationCandidate(notificationsOffInput, notificationsOffCandidate),
  'Notification preference must suppress push publication without suppressing Home.',
);

const event = projectCommunitySchoolItemToNotificationEvent(suppliesInput, now);
assert(event, 'Authorized school actions should map to the shared notification.candidate event.');
assert(event.type === 'notification.candidate', 'Community must reuse the existing Event Core event type.');
assert(event.subjectRef === 'guardian-1', 'Event subject must be the intended recipient user.');
assert(event.payload.candidate.domain === 'school', 'Projected event must preserve the school domain.');

console.log('PASS: community Home projection tests');
