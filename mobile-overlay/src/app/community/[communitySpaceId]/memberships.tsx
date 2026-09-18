import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { FilterChip } from '../../../components/common/FilterChip';
import { PaltaButton } from '../../../components/common/PaltaButton';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import {
  communityMembershipRuntime,
  type CommunityMembershipRoleKey,
} from '../../../features/community/communityMembershipRuntime';
import { canAssignCommunityRole } from '../../../../../src/community/communityMembershipLifecycle';
import { paltaTheme } from '../../../theme/paltaTheme';

const roleLabel: Record<CommunityMembershipRoleKey, string> = {
  member: 'Miembro',
  guardian: 'Apoderado/a',
  student: 'Estudiante',
  teacher: 'Docente',
  staff: 'Equipo',
  leader: 'Encargado/a',
  admin: 'Administrador/a',
};

const roles: CommunityMembershipRoleKey[] = ['member', 'guardian', 'student', 'teacher', 'staff', 'leader', 'admin'];

export default function CommunityMembershipsScreen() {
  const { communitySpaceId } = useLocalSearchParams<{ communitySpaceId: string }>();
  const [selectedRoles, setSelectedRoles] = useState<Record<string, CommunityMembershipRoleKey>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!communitySpaceId) throw new Error('Community space ID missing');
    return communityMembershipRuntime.load(communitySpaceId);
  }, [communitySpaceId]);
  const { state, refresh } = useAsyncResource(load);

  const assignableRoles = useMemo(
    () => roles.filter((role) => state.data ? canAssignCommunityRole(state.data.currentRoleKey, role) : false),
    [state.data],
  );

  if (state.status === 'loading' && !state.data) {
    return <ScreenFrame title="Acceso y miembros"><LoadingState label="Cargando solicitudes…" /></ScreenFrame>;
  }
  if (state.status === 'error' && !state.data) {
    return <ScreenFrame title="Acceso y miembros"><ErrorState message={state.message} onRetry={() => void refresh()} /></ScreenFrame>;
  }
  const data = state.data;
  if (!data || !communitySpaceId) return <ScreenFrame title="Acceso y miembros"><Text>No hay datos disponibles.</Text></ScreenFrame>;

  const decide = async (membershipId: string, action: 'approve' | 'reject' | 'end', roleKey?: CommunityMembershipRoleKey) => {
    if (workingId) return;
    setWorkingId(membershipId);
    try {
      await communityMembershipRuntime.decide({
        spaceId: communitySpaceId,
        membershipId,
        action,
        ...(roleKey ? { roleKey } : {}),
      });
      await refresh();
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <ScreenFrame title="Acceso y miembros" subtitle="Aprueba relaciones reales y corta el acceso cuando terminen">
      <View style={{ gap: paltaTheme.spacing.xl }}>
        <View style={{ padding: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surfaceMuted }}>
          <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textSecondary }}>
            Las solicitudes pendientes no reciben contenido privado ni notificaciones. Al finalizar una relación, Palta deja de entregar avisos de ese grupo.
          </Text>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Solicitudes</Text>
            <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>{data.pending.length}</Text>
          </View>

          {data.pending.length === 0 ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>No hay solicitudes pendientes.</Text>
          ) : data.pending.map((request) => {
            const requestedRole = assignableRoles.includes(request.requestedRoleKey) ? request.requestedRoleKey : assignableRoles[0] ?? 'member';
            const selectedRole = selectedRoles[request.membershipId] ?? requestedRole;
            return (
              <View key={request.membershipId} style={{ paddingVertical: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{request.memberLabel}</Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: paltaTheme.color.textMuted }}>Solicita: {roleLabel[request.requestedRoleKey]}</Text>
                <View style={{ marginTop: paltaTheme.spacing.sm, flexDirection: 'row', gap: paltaTheme.spacing.xs, flexWrap: 'wrap' }}>
                  {assignableRoles.map((role) => (
                    <FilterChip key={role} label={roleLabel[role]} selected={selectedRole === role} onPress={() => setSelectedRoles((current) => ({ ...current, [request.membershipId]: role }))} />
                  ))}
                </View>
                <View style={{ marginTop: paltaTheme.spacing.sm, flexDirection: 'row', gap: paltaTheme.spacing.sm, alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <PaltaButton label={workingId === request.membershipId ? 'Procesando…' : 'Aprobar'} disabled={workingId !== null} onPress={() => void decide(request.membershipId, 'approve', selectedRole)} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={workingId !== null}
                    onPress={() => void decide(request.membershipId, 'reject')}
                    style={({ pressed }) => ({ minHeight: paltaTheme.touch.minimum, justifyContent: 'center', paddingHorizontal: paltaTheme.spacing.md, opacity: pressed ? 0.65 : 1 })}
                  >
                    <Text style={{ fontWeight: '700', color: paltaTheme.color.textSecondary }}>Rechazar</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Miembros activos</Text>
          {data.active.map((member) => (
            <View key={member.membershipId} style={{ minHeight: paltaTheme.touch.minimum, paddingVertical: paltaTheme.spacing.sm, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider, flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.sm, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{member.memberLabel}</Text>
                <Text style={{ marginTop: 3, fontSize: 12, color: paltaTheme.color.textMuted }}>{roleLabel[member.roleKey]}{member.isSelf ? ' · Tú' : ''}</Text>
              </View>
              {!member.isSelf ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={workingId !== null}
                  onPress={() => void decide(member.membershipId, 'end')}
                  style={({ pressed }) => ({ minHeight: paltaTheme.touch.minimum, justifyContent: 'center', paddingHorizontal: paltaTheme.spacing.sm, opacity: pressed ? 0.65 : 1 })}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.textSecondary }}>Finalizar vínculo</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </ScreenFrame>
  );
}
