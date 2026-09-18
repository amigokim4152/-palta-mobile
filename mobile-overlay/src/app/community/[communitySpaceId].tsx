import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorState, LoadingState } from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { PaltaButton } from '../../components/common/PaltaButton';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { communityRuntime } from '../../features/community/communityRuntime';
import { paltaTheme } from '../../theme/paltaTheme';

export default function CommunitySpaceScreen() {
  const { communitySpaceId } = useLocalSearchParams<{ communitySpaceId: string }>();
  const [joining, setJoining] = useState(false);
  const load = useCallback(() => {
    if (!communitySpaceId) throw new Error('Community space ID missing');
    return communityRuntime.loadSpace(communitySpaceId);
  }, [communitySpaceId]);
  const { state, refresh } = useAsyncResource(load);

  if (state.status === 'loading' && !state.data) return <ScreenFrame title="Comunidad"><LoadingState label="Cargando comunidad…" /></ScreenFrame>;
  if (state.status === 'error' && !state.data) return <ScreenFrame title="Comunidad"><ErrorState message={state.message} onRetry={() => void refresh()} /></ScreenFrame>;
  const space = state.data;
  if (!space) return <ScreenFrame title="Comunidad"><Text>No hay datos disponibles.</Text></ScreenFrame>;

  const join = async () => {
    if (joining || !space.canJoin) return;
    setJoining(true);
    try {
      await communityRuntime.joinSpace(space.id);
      await refresh();
    } finally {
      setJoining(false);
    }
  };

  return (
    <ScreenFrame title={space.name} subtitle={space.subtitle}>
      <View style={{ gap: paltaTheme.spacing.xl }}>
        {space.membershipState !== 'active' ? (
          <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{space.joinLabel}</Text>
            <Text style={{ marginTop: 5, lineHeight: 20, color: paltaTheme.color.textSecondary }}>{space.joinDescription}</Text>
            {space.canJoin ? <View style={{ marginTop: paltaTheme.spacing.sm }}><PaltaButton label={joining ? 'Uniéndote…' : space.joinActionLabel} onPress={() => void join()} disabled={joining} /></View> : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: paltaTheme.touch.minimum }}>
            <Text style={{ color: paltaTheme.color.brandPrimary, fontWeight: '700' }}>Miembro</Text>
            <Text style={{ color: paltaTheme.color.textMuted, fontSize: 13 }}>Publicaciones y conversación</Text>
          </View>
        )}

        <View>
          <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Publicaciones</Text>
          {space.posts.length === 0 ? (
            <View style={{ paddingVertical: paltaTheme.spacing.lg }}>
              <Text style={{ color: paltaTheme.color.textPrimary, fontWeight: '700' }}>Todavía no hay publicaciones.</Text>
              <Text style={{ marginTop: 5, lineHeight: 20, color: paltaTheme.color.textSecondary }}>Los avisos y conversaciones de esta comunidad aparecerán aquí.</Text>
            </View>
          ) : space.posts.map((post) => (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir publicación de ${post.author}`}
              onPress={() => router.push(`/community/${space.id}/post/${post.id}`)}
              style={({ pressed }) => ({ minHeight: paltaTheme.touch.minimum, paddingVertical: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider, opacity: pressed ? 0.72 : 1 })}
            >
              <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{post.author} · {post.timeLabel}</Text>
              <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 21, color: paltaTheme.color.textPrimary }}>{post.body}</Text>
              <Text style={{ marginTop: 10, fontSize: 13, color: paltaTheme.color.textSecondary }}>Comentarios {post.commentCount} · Reacciones {post.reactionCount}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenFrame>
  );
}
