import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  canAccessSchoolNode,
  canViewSensitiveSchoolContent,
  schoolHierarchyPath,
  type SchoolCommunityNode,
  type SchoolRelationStatus,
  type SchoolRelationship,
} from '../../../../src/community/schoolCommunityHierarchy';
import type { CommunityMembershipState } from './communityRuntime';
import { paltaTheme } from '../../theme/paltaTheme';

const scopeLabel: Record<SchoolCommunityNode['scope'], string> = {
  school: 'Colegio',
  grade: 'Nivel',
  class: 'Curso',
  parents: 'Familias',
};

function relationStatus(membershipState: CommunityMembershipState): SchoolRelationStatus | null {
  if (membershipState === 'active') return 'active';
  if (membershipState === 'pending') return 'pending';
  if (membershipState === 'invite_required') return 'invite_required';
  return null;
}

function buildContext(input: {
  spaceId: string;
  spaceName: string;
  membershipState: CommunityMembershipState;
}): {
  nodes: SchoolCommunityNode[];
  relationships: SchoolRelationship[];
  focusNodeId: string;
} {
  const schoolNode: SchoolCommunityNode = {
    id: `${input.spaceId}:school`,
    scope: 'school',
    label: input.spaceName,
    privateByDefault: true,
  };

  if (input.spaceId !== 'school-1') {
    const status = relationStatus(input.membershipState);
    return {
      nodes: [schoolNode],
      relationships: status
        ? [{ id: `${input.spaceId}:relation`, nodeId: schoolNode.id, role: 'member', status }]
        : [],
      focusNodeId: schoolNode.id,
    };
  }

  const gradeNode: SchoolCommunityNode = {
    id: `${input.spaceId}:grade`,
    scope: 'grade',
    label: '4º básico',
    parentId: schoolNode.id,
    privateByDefault: true,
  };
  const classNode: SchoolCommunityNode = {
    id: `${input.spaceId}:class`,
    scope: 'class',
    label: 'Curso del estudiante',
    parentId: gradeNode.id,
    privateByDefault: true,
  };
  const parentsNode: SchoolCommunityNode = {
    id: `${input.spaceId}:parents`,
    scope: 'parents',
    label: 'Familias del curso',
    parentId: classNode.id,
    privateByDefault: true,
  };
  const status = relationStatus(input.membershipState);

  return {
    nodes: [schoolNode, gradeNode, classNode, parentsNode],
    relationships: status
      ? [{
          id: `${input.spaceId}:guardian-relation`,
          nodeId: parentsNode.id,
          role: 'guardian',
          status,
        }]
      : [],
    focusNodeId: parentsNode.id,
  };
}

function membershipStatusCopy(state: CommunityMembershipState): string {
  if (state === 'active') return 'Relación activa';
  if (state === 'pending') return 'Pendiente de aprobación';
  if (state === 'invite_required') return 'Acceso por invitación';
  return 'Sin relación activa';
}

export function SchoolRelationshipPanel(props: {
  spaceId: string;
  spaceName: string;
  membershipState: CommunityMembershipState;
}) {
  const context = useMemo(() => buildContext(props), [props.spaceId, props.spaceName, props.membershipState]);
  const [selectedNodeId, setSelectedNodeId] = useState(context.focusNodeId);
  const selectedNode = context.nodes.find((node) => node.id === selectedNodeId) ?? context.nodes[0];
  if (!selectedNode) return null;

  const now = new Date();
  const path = schoolHierarchyPath(context.nodes, selectedNode.id);
  const canAccess = canAccessSchoolNode({
    nodes: context.nodes,
    relationships: context.relationships,
    nodeId: selectedNode.id,
    now,
  });
  const canSeeSensitive = canViewSensitiveSchoolContent({
    nodes: context.nodes,
    relationships: context.relationships,
    nodeId: selectedNode.id,
    now,
  });

  return (
    <View style={{ gap: paltaTheme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Tu relación escolar</Text>
          <Text style={{ marginTop: 4, color: paltaTheme.color.textSecondary, lineHeight: 19 }}>
            Colegio → nivel → curso → familias. Cada nivel conserva su propio acceso privado.
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '700', color: props.membershipState === 'active' ? paltaTheme.color.brandPrimary : paltaTheme.color.textMuted }}>
          {membershipStatusCopy(props.membershipState)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs, flexWrap: 'wrap' }}>
        {context.nodes.map((node) => {
          const selected = node.id === selectedNode.id;
          return (
            <Pressable
              key={node.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Ver nivel ${scopeLabel[node.scope]} ${node.label}`}
              onPress={() => setSelectedNodeId(node.id)}
              style={({ pressed }) => ({
                minHeight: paltaTheme.touch.minimum,
                justifyContent: 'center',
                paddingHorizontal: paltaTheme.spacing.sm,
                borderRadius: paltaTheme.radius.pill,
                borderWidth: 1,
                borderColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
                backgroundColor: selected ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: selected ? '700' : '600', color: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.textSecondary }}>
                {scopeLabel[node.scope]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ padding: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surfaceMuted }}>
        <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{path.map((node) => node.label).join(' › ')}</Text>
        <Text style={{ marginTop: 5, fontSize: 15, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{selectedNode.label}</Text>
        <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: paltaTheme.color.textSecondary }}>
          {props.membershipState === 'pending'
            ? 'Tu solicitud todavía no abre contenido privado ni activa notificaciones de este nivel.'
            : props.membershipState === 'invite_required'
              ? 'Este nivel requiere una relación verificada o una invitación válida.'
              : canAccess
                ? 'Tu relación actual permite ver este nivel. Los niveles inferiores no se abren automáticamente por pertenecer a un nivel superior.'
                : 'Tu relación actual no permite ver este nivel privado.'}
        </Text>
        {canSeeSensitive ? (
          <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>
            Los avisos personales solo aparecen dentro de una relación autorizada y no se publican en superficies abiertas.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
