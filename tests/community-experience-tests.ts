import {
  acknowledgeSchoolFlowItem,
  defaultTrustScopeForCommunityKind,
  orderSchoolFlowItems,
  safeCommunityAuthorLabel,
  schoolFlowProgress,
  shouldDeliverCommunityNotification,
  type SchoolStructuredItem,
} from '../src/community/communityExperience.js';
import {
  canAccessSchoolNode,
  canViewSensitiveSchoolContent,
  deepestActiveSchoolNode,
  isSchoolRelationshipActive,
  schoolHierarchyPath,
  type SchoolCommunityNode,
  type SchoolRelationship,
} from '../src/community/schoolCommunityHierarchy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const schoolItems: SchoolStructuredItem[] = [
  {
    id: 'supplies',
    postId: 'post-supplies',
    stage: 'supplies',
    title: 'Materiales',
    detail: 'Cuaderno de ciencias',
    status: 'pending',
    actionRequired: true,
    sensitive: false,
  },
  {
    id: 'notice',
    postId: 'post-notice',
    stage: 'announcement',
    title: 'Aviso',
    detail: 'Salida confirmada',
    status: 'done',
    actionRequired: false,
    sensitive: false,
  },
  {
    id: 'child',
    postId: 'post-child',
    stage: 'child_notice',
    title: 'Autorización',
    detail: 'Revisión familiar',
    status: 'pending',
    actionRequired: true,
    sensitive: true,
  },
  {
    id: 'schedule',
    postId: 'post-schedule',
    stage: 'schedule',
    title: 'Reunión',
    detail: 'Martes 18:30',
    status: 'pending',
    actionRequired: false,
    sensitive: false,
  },
];

const ordered = orderSchoolFlowItems(schoolItems);
assert(
  ordered.map((item) => item.stage).join('|') ===
    'announcement|schedule|supplies|child_notice',
  'School flow must remain aviso -> calendario -> preparar -> child notice.',
);

const initialProgress = schoolFlowProgress(ordered);
assert(initialProgress.total === 4, 'School flow should count all structured stages.');
assert(initialProgress.completed === 1, 'Completed school notice should count as reviewed.');
assert(initialProgress.pendingActionCount === 2, 'Two school actions should require attention.');

const acknowledged = acknowledgeSchoolFlowItem(ordered, 'post-supplies');
const acknowledgedProgress = schoolFlowProgress(acknowledged);
assert(acknowledgedProgress.completed === 2, 'Acknowledging supplies must advance progress.');
assert(acknowledgedProgress.pendingActionCount === 1, 'Acknowledging supplies must clear its pending action.');

assert(defaultTrustScopeForCommunityKind('school') === 'member_group', 'School must default to member-only access.');
assert(defaultTrustScopeForCommunityKind('apartment') === 'member_group', 'Building must default to member-only access.');
assert(defaultTrustScopeForCommunityKind('neighborhood') === 'verified_local', 'Neighborhood should require verified local context.');
assert(defaultTrustScopeForCommunityKind('activity') === 'public_local', 'Public local activities may be discoverable.');

const now = new Date('2026-09-18T15:00:00-03:00');
assert(
  shouldDeliverCommunityNotification({
    membershipState: 'active',
    relationshipActive: true,
    notificationsEnabled: true,
    now,
  }),
  'Active relationship may receive community notifications.',
);
assert(
  !shouldDeliverCommunityNotification({
    membershipState: 'active',
    relationshipActive: false,
    notificationsEnabled: true,
    now,
  }),
  'Ended relationship must suppress community notifications.',
);
assert(
  !shouldDeliverCommunityNotification({
    membershipState: 'active',
    relationshipActive: true,
    notificationsEnabled: true,
    effectiveTo: '2026-09-17T23:59:59-03:00',
    now,
  }),
  'Expired relationship must suppress community notifications.',
);
assert(
  !shouldDeliverCommunityNotification({
    membershipState: 'pending',
    relationshipActive: true,
    notificationsEnabled: true,
    now,
  }),
  'Pending membership must not receive private group notifications.',
);

assert(
  safeCommunityAuthorLabel({
    displayName: 'Nombre privado',
    groupRoleLabel: 'Familias 4º básico',
    scope: 'member_group',
    viewerIsMember: false,
  }) === 'Familias 4º básico',
  'Non-members must receive a role label instead of an exact private identity.',
);
assert(
  safeCommunityAuthorLabel({
    displayName: 'Nombre privado',
    scope: 'member_group',
    viewerIsMember: true,
  }) === 'Nombre privado',
  'Authorized members may receive the in-group display identity.',
);

const schoolNodes: SchoolCommunityNode[] = [
  { id: 'school', scope: 'school', label: 'Colegio', privateByDefault: true },
  { id: 'grade', scope: 'grade', label: '4º básico', parentId: 'school', privateByDefault: true },
  { id: 'class', scope: 'class', label: 'Curso', parentId: 'grade', privateByDefault: true },
  { id: 'parents', scope: 'parents', label: 'Familias', parentId: 'class', privateByDefault: true },
];
const guardianRelation: SchoolRelationship = {
  id: 'guardian',
  nodeId: 'parents',
  role: 'guardian',
  status: 'active',
};

assert(
  schoolHierarchyPath(schoolNodes, 'parents').map((node) => node.scope).join('|') ===
    'school|grade|class|parents',
  'School hierarchy must preserve school -> grade -> class -> parents ancestry.',
);
assert(
  canAccessSchoolNode({ nodes: schoolNodes, relationships: [guardianRelation], nodeId: 'school', now }),
  'A verified class-family relation may read compatible school-level information.',
);
assert(
  canAccessSchoolNode({ nodes: schoolNodes, relationships: [guardianRelation], nodeId: 'class', now }),
  'A verified family relation may read its class level.',
);
assert(
  canAccessSchoolNode({ nodes: schoolNodes, relationships: [guardianRelation], nodeId: 'parents', now }),
  'A verified family relation may read its parent-group level.',
);
assert(
  canViewSensitiveSchoolContent({ nodes: schoolNodes, relationships: [guardianRelation], nodeId: 'class', now }),
  'Guardian relation may receive sensitive class-linked notices.',
);

const classOnlyRelation: SchoolRelationship = {
  id: 'class-member',
  nodeId: 'class',
  role: 'member',
  status: 'active',
};
assert(
  !canAccessSchoolNode({ nodes: schoolNodes, relationships: [classOnlyRelation], nodeId: 'parents', now }),
  'A class relation must not automatically open the lower parent-only space.',
);
assert(
  !canViewSensitiveSchoolContent({ nodes: schoolNodes, relationships: [classOnlyRelation], nodeId: 'class', now }),
  'Generic class membership must not expose sensitive child-related content.',
);

const pendingGuardian: SchoolRelationship = { ...guardianRelation, id: 'pending', status: 'pending' };
assert(
  !canAccessSchoolNode({ nodes: schoolNodes, relationships: [pendingGuardian], nodeId: 'class', now }),
  'Pending school approval must not open private class content.',
);
assert(
  !isSchoolRelationshipActive({ ...guardianRelation, effectiveTo: '2026-09-18T14:59:59-03:00' }, now),
  'Expired school relationship must fail closed.',
);
assert(
  deepestActiveSchoolNode({ nodes: schoolNodes, relationships: [guardianRelation], now })?.id === 'parents',
  'The deepest active school node should represent the most specific authorized relation.',
);

console.log('PASS: community experience policy tests');
