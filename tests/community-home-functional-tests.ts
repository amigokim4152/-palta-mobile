import { communityToFunctionalHome } from '../src/home/adapters/communityFunctionalAdapter.js';
import { scheduledEventsToFunctionalHome } from '../src/home/adapters/scheduledFunctionalAdapter.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-18T12:00:00.000Z');
const projection = communityToFunctionalHome(
  {
    dataMode: 'live',
    observedAt: '2026-09-18T11:58:00.000Z',
    memberships: [
      {
        communitySpaceId: 'school-1',
        name: 'Colegio',
        spaceType: 'school',
        membershipState: 'active',
      },
      {
        communitySpaceId: 'apartment-1',
        name: 'Edificio',
        spaceType: 'apartment',
        membershipState: 'pending',
      },
    ],
    notices: [
      {
        communitySpaceId: 'school-1',
        postId: 'important-school-notice',
        communityName: 'Colegio',
        spaceType: 'school',
        body: 'Mañana cambia el acceso de entrada.',
        createdAt: '2026-09-18T10:00:00.000Z',
        announcement: true,
        pinned: true,
        membershipState: 'active',
      },
      {
        communitySpaceId: 'school-1',
        postId: 'ordinary-post',
        communityName: 'Colegio',
        spaceType: 'school',
        body: 'Publicación normal.',
        createdAt: '2026-09-18T11:00:00.000Z',
        announcement: false,
        pinned: false,
        membershipState: 'active',
      },
      {
        communitySpaceId: 'school-1',
        postId: 'unpinned-announcement',
        communityName: 'Colegio',
        spaceType: 'school',
        body: 'Aviso no fijado.',
        createdAt: '2026-09-18T11:00:00.000Z',
        announcement: true,
        pinned: false,
        membershipState: 'active',
      },
      {
        communitySpaceId: 'school-1',
        postId: 'old-notice',
        communityName: 'Colegio',
        spaceType: 'school',
        body: 'Aviso antiguo.',
        createdAt: '2026-09-14T11:00:00.000Z',
        announcement: true,
        pinned: true,
        membershipState: 'active',
      },
    ],
  },
  now,
);

assert(projection.items.length === 2, 'Only pending membership and fresh important notice should reach Home.');
const pending = projection.items.find((item) => item.id.includes('apartment-1'));
const schoolNotice = projection.items.find((item) => item.id.includes('important-school-notice'));
assert(pending?.surface === 'in_progress', 'Pending Community membership belongs in EN CURSO.');
assert(pending?.kind === 'status', 'Pending membership is status, not action noise.');
assert(
  pending?.action?.target === '/community/apartment-1',
  'Pending membership should deep-link to the exact Community space.',
);
assert(schoolNotice?.surface === 'useful_today', 'Important current school notice belongs in PARA HOY.');
assert(
  schoolNotice?.action?.target === '/community/school-1/post/important-school-notice',
  'Important Community notice must deep-link to its thread.',
);
assert(
  projection.items.every((item) => validateHomeFunctionalItem(item).length === 0),
  'Community projections must satisfy the shared Home contract.',
);
assert(
  !projection.items.some((item) => item.id.includes('ordinary-post')),
  'Ordinary Community posts must stay on the Community surface.',
);

const unavailable = communityToFunctionalHome({
  dataMode: 'unavailable',
  observedAt: now.toISOString(),
  memberships: [{
    communitySpaceId: 'school-1',
    name: 'Colegio',
    spaceType: 'school',
    membershipState: 'pending',
  }],
  notices: [],
});
assert(unavailable.items.length === 0, 'Unavailable Community source must not fabricate Home items.');

// School/community dates use the shared schedule contract instead of another
// Community-specific calendar model.
const scheduled = scheduledEventsToFunctionalHome(
  {
    sourceDomain: 'school',
    dataMode: 'scheduled',
    observedAt: now.toISOString(),
    events: [
      {
        id: 'school-event-1',
        title: 'Actividad del colegio',
        scheduledAt: '2026-09-19T14:00:00.000Z',
        confirmed: true,
        personalized: true,
        action: {
          label: 'Ver detalle',
          kind: 'internal',
          target: '/community/school-1/post/event-1',
        },
      },
    ],
  },
  now,
);
assert(scheduled[0]?.surface === 'upcoming', 'Confirmed school event should use shared PRÓXIMO scheduling.');

console.log('PASS: Community -> Home functional projection tests');
