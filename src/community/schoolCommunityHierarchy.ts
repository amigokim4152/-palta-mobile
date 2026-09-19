export type SchoolCommunityScope = 'school' | 'grade' | 'class' | 'parents';

export type SchoolRelationRole =
  | 'guardian'
  | 'student'
  | 'teacher'
  | 'staff'
  | 'admin'
  | 'member';

export type SchoolRelationStatus =
  | 'active'
  | 'pending'
  | 'ended'
  | 'invite_required';

export type SchoolCommunityNode = {
  id: string;
  scope: SchoolCommunityScope;
  label: string;
  parentId?: string;
  privateByDefault: boolean;
};

export type SchoolRelationship = {
  id: string;
  nodeId: string;
  role: SchoolRelationRole;
  status: SchoolRelationStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
};

function validBoundary(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSchoolRelationshipActive(
  relationship: SchoolRelationship,
  now: Date,
): boolean {
  if (relationship.status !== 'active') return false;

  if (relationship.effectiveFrom) {
    const effectiveFrom = validBoundary(relationship.effectiveFrom);
    if (!effectiveFrom || effectiveFrom.getTime() > now.getTime()) return false;
  }

  if (relationship.effectiveTo) {
    const effectiveTo = validBoundary(relationship.effectiveTo);
    if (!effectiveTo || effectiveTo.getTime() <= now.getTime()) return false;
  }

  return true;
}

export function schoolHierarchyPath(
  nodes: readonly SchoolCommunityNode[],
  nodeId: string,
): SchoolCommunityNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const path: SchoolCommunityNode[] = [];
  const visited = new Set<string>();
  let current = byId.get(nodeId);

  if (!current) return [];

  while (current) {
    if (visited.has(current.id)) return [];
    visited.add(current.id);
    path.unshift(current);

    if (!current.parentId) break;
    const parent = byId.get(current.parentId);
    if (!parent) return [];
    current = parent;
  }

  return path;
}

export function canAccessSchoolNode(input: {
  nodes: readonly SchoolCommunityNode[];
  relationships: readonly SchoolRelationship[];
  nodeId: string;
  now: Date;
}): boolean {
  return input.relationships.some((relationship) => {
    if (!isSchoolRelationshipActive(relationship, input.now)) return false;
    const relationshipPath = schoolHierarchyPath(input.nodes, relationship.nodeId);
    return relationshipPath.some((node) => node.id === input.nodeId);
  });
}

const SENSITIVE_ROLES = new Set<SchoolRelationRole>([
  'guardian',
  'teacher',
  'staff',
  'admin',
]);

export function canViewSensitiveSchoolContent(input: {
  nodes: readonly SchoolCommunityNode[];
  relationships: readonly SchoolRelationship[];
  nodeId: string;
  now: Date;
}): boolean {
  return input.relationships.some((relationship) => {
    if (!SENSITIVE_ROLES.has(relationship.role)) return false;
    if (!isSchoolRelationshipActive(relationship, input.now)) return false;
    const relationshipPath = schoolHierarchyPath(input.nodes, relationship.nodeId);
    return relationshipPath.some((node) => node.id === input.nodeId);
  });
}

export function deepestActiveSchoolNode(input: {
  nodes: readonly SchoolCommunityNode[];
  relationships: readonly SchoolRelationship[];
  now: Date;
}): SchoolCommunityNode | undefined {
  let best: { node: SchoolCommunityNode; depth: number } | undefined;

  for (const relationship of input.relationships) {
    if (!isSchoolRelationshipActive(relationship, input.now)) continue;
    const path = schoolHierarchyPath(input.nodes, relationship.nodeId);
    const node = path[path.length - 1];
    if (!node) continue;
    if (!best || path.length > best.depth) best = { node, depth: path.length };
  }

  return best?.node;
}
