import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorState, LoadingState } from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { FilterChip } from '../../components/common/FilterChip';
import { PaltaButton } from '../../components/common/PaltaButton';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { SchoolRelationshipPanel } from '../../features/community/SchoolRelationshipPanel';
import {
  communityRuntime,
  type CommunityPostPurpose,
  type SchoolFlowStage,
} from '../../features/community/communityRuntime';
import { schoolFlowProgress } from '../../../../src/community/communityExperience';
import { paltaTheme } from '../../theme/paltaTheme';

const stageLabel: Record<SchoolFlowStage, string> = {
  announcement: 'Aviso',
  schedule: 'Calendario',
  supplies: 'Preparar',
  child_notice: 'Para tu hijo/a',
};

type PostFilter = 'all' | SchoolFlowStage | 'discussion';

function privacyCopy(scope: string | undefined): string | null {
  if (scope === 'member_group' || scope === 'private_relation') return 'Espacio privado. El contenido y los datos de relación solo se muestran a miembros autorizados.';
  if (scope === 'verified_local') return 'Espacio local. Palta evita publicar datos personales precisos en superficies abiertas.';
  return null;
}

export default function CommunitySpaceScreen() {
  const { communitySpaceId } = useLocalSearchParams<{ communitySpaceId: string }>();
  const [joining, setJoining] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [postFilter, setPostFilter] = useState<PostFilter>('all');
  const load = useCallback(() => {
    if (!communitySpaceId) throw new Error('Community space ID missing');
    return communityRuntime.loadSpace(communitySpaceId);
  }, [communitySpaceId]);
  const { state, refresh } = useAsyncResource(load);

  const filteredPosts = useMemo(() => {
    const posts = state.data?.posts ?? [];
    if (postFilter === 'all') return posts;
    return posts.filter((post) => post.purpose === postFilter);
  }, [postFilter, state.data?.posts]);

  if (state.status === 'loading' && !state.data) return <ScreenFrame title="Comunidad"><LoadingState label="Cargando comunidad…" /></ScreenFrame>;
  if (state.status === 'error' && !state.data) return <ScreenFrame title="Comunidad"><ErrorState message={state.message} onRetry={() => void refresh()} /></ScreenFrame>;
  const space = state.data;
  if (!space) return <ScreenFrame title="Comunidad"><Text>No hay datos disponibles.</Text></ScreenFrame>;

  const join = async () => {
    if (joining || !space.canJoin) return;
    setJoining(true);
    try { await communityRuntime.joinSpace(space.id); await refresh(); } finally { setJoining(false); }
  };

  const acknowledge = async (postId: string) => {
    if (acknowledging) return;
    setAcknowledging(postId);
    try { await communityRuntime.acknowledgePost(space.id, postId); await refresh(); } finally { setAcknowledging(null); }
  };

  const schoolItems = space.schoolItems ?? [];
  const progress = schoolFlowProgress(schoolItems);
  const privacy = privacyCopy(space.trustScope);
  const previewManager = !process.env.EXPO_PUBLIC_PALTA_API_BASE_URL && process.env.EXPO_PUBLIC_ENV !== 'production' && space.id === 'school-1';
  const canManageMemberships = space.membershipState === 'active' && (space.roleKey === 'leader' || space.roleKey === 'admin' || previewManager);

  return (
    <ScreenFrame title={space.name} subtitle={space.subtitle}>
      <View style={{ gap: paltaTheme.spacing.xl }}>
        {privacy ? <View style={{ padding: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surfaceMuted }}><Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textSecondary }}>{privacy}</Text></View> : null}

        {space.membershipState !== 'active' ? (
          <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{space.joinLabel}</Text>
            <Text style={{ marginTop: 5, lineHeight: 20, color: paltaTheme.color.textSecondary }}>{space.joinDescription}</Text>
            {space.canJoin ? <View style={{ marginTop: paltaTheme.spacing.sm }}><PaltaButton label={joining ? 'Enviando…' : space.joinActionLabel} onPress={() => void join()} disabled={joining} /></View> : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: paltaTheme.touch.minimum }}>
            <View>
              <Text style={{ color: paltaTheme.color.brandPrimary, fontWeight: '700' }}>Miembro</Text>
              <Text style={{ marginTop: 3, color: paltaTheme.color.textMuted, fontSize: 12 }}>Relación activa · notificaciones según tu vínculo</Text>
            </View>
          </View>
        )}

        {space.kind === 'school' ? <SchoolRelationshipPanel spaceId={space.id} spaceName={space.name} membershipState={space.membershipState} /> : null}

        {canManageMemberships ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gestionar solicitudes y miembros"
            onPress={() => router.push(`/community/${space.id}/memberships`)}
            style={({ pressed }) => ({ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft, opacity: pressed ? 0.72 : 1 })}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Solicitudes y miembros</Text>
            <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: paltaTheme.color.textSecondary }}>Aprueba accesos, asigna el rol correcto y finaliza relaciones que ya terminaron.</Text>
          </Pressable>
        ) : null}

        {space.membershipState === 'active' && schoolItems.length > 0 ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.md, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Lo importante de la escuela</Text>
                <Text style={{ marginTop: 4, color: paltaTheme.color.textSecondary, lineHeight: 19 }}>Aviso → calendario → preparar → seguimiento</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: progress.pendingActionCount > 0 ? paltaTheme.color.brandPrimary : paltaTheme.color.textMuted }}>{progress.completed}/{progress.total}</Text>
            </View>

            {schoolItems.map((item) => (
              <View key={item.id} style={{ paddingVertical: paltaTheme.spacing.sm, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}`} onPress={() => router.push(`/community/${space.id}/post/${item.postId}`)} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: paltaTheme.color.brandPrimary }}>{stageLabel[item.stage]}</Text>
                        {item.sensitive ? <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>Solo tú</Text> : null}
                        {item.dueLabel ? <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{item.dueLabel}</Text> : null}
                      </View>
                      <Text style={{ marginTop: 4, fontSize: 15, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{item.title}</Text>
                      <Text style={{ marginTop: 3, fontSize: 13, lineHeight: 18, color: paltaTheme.color.textSecondary }}>{item.detail}</Text>
                    </View>
                    {item.status !== 'pending' ? <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>Confirmado</Text> : null}
                  </View>
                </Pressable>
                {item.actionRequired && item.status === 'pending' ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Confirmar ${item.title}`} disabled={acknowledging === item.postId} onPress={() => void acknowledge(item.postId)} style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: paltaTheme.touch.minimum, marginTop: 6, justifyContent: 'center', paddingHorizontal: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.brandSoft, opacity: pressed ? 0.72 : 1 })}>
                    <Text style={{ color: paltaTheme.color.brandPrimary, fontWeight: '700' }}>{acknowledging === item.postId ? 'Confirmando…' : 'Confirmar'}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <View style={{ paddingTop: 2 }}><Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>WhatsApp sigue siendo útil para conversar rápido. Palta organiza aquí avisos, fechas y pendientes que conviene volver a encontrar.</Text></View>
          </View>
        ) : null}

        {space.membershipState === 'active' && space.kind === 'school' ? (
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs, flexWrap: 'wrap' }}>
            <FilterChip label="Todo" selected={postFilter === 'all'} onPress={() => setPostFilter('all')} />
            <FilterChip label="Avisos" selected={postFilter === 'announcement'} onPress={() => setPostFilter('announcement')} />
            <FilterChip label="Calendario" selected={postFilter === 'schedule'} onPress={() => setPostFilter('schedule')} />
            <FilterChip label="Preparar" selected={postFilter === 'supplies'} onPress={() => setPostFilter('supplies')} />
            <FilterChip label="Conversación" selected={postFilter === 'discussion'} onPress={() => setPostFilter('discussion')} />
          </View>
        ) : null}

        <View>
          <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Publicaciones</Text>
          {filteredPosts.length === 0 ? (
            <View style={{ paddingVertical: paltaTheme.spacing.lg }}>
              <Text style={{ color: paltaTheme.color.textPrimary, fontWeight: '700' }}>No hay publicaciones en esta vista.</Text>
              <Text style={{ marginTop: 5, lineHeight: 20, color: paltaTheme.color.textSecondary }}>Los avisos y conversaciones que tengas permiso para ver aparecerán aquí.</Text>
            </View>
          ) : filteredPosts.map((post) => (
            <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={`Abrir publicación de ${post.author}`} onPress={() => router.push(`/community/${space.id}/post/${post.id}`)} style={({ pressed }) => ({ minHeight: paltaTheme.touch.minimum, paddingVertical: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider, opacity: pressed ? 0.72 : 1 })}>
              <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{post.author} · {post.timeLabel}</Text>
                {post.sensitive ? <Text style={{ fontSize: 12, fontWeight: '700', color: paltaTheme.color.brandPrimary }}>Privado</Text> : null}
                {post.acknowledged ? <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>Confirmado</Text> : null}
              </View>
              {post.title ? <Text style={{ marginTop: 6, fontSize: 15, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{post.title}</Text> : null}
              <Text style={{ marginTop: post.title ? 4 : 8, fontSize: 15, lineHeight: 21, color: paltaTheme.color.textPrimary }}>{post.body}</Text>
              <Text style={{ marginTop: 10, fontSize: 13, color: paltaTheme.color.textSecondary }}>Comentarios {post.commentCount} · Reacciones {post.reactionCount}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenFrame>
  );
}
