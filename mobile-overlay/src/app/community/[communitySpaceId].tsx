import { useCallback } from 'react';
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
  const load = useCallback(() => {
    if (!communitySpaceId) throw new Error('Community space ID missing');
    return communityRuntime.loadSpace(communitySpaceId);
  }, [communitySpaceId]);
  const { state, refresh } = useAsyncResource(load);

  if (state.status === 'loading' && !state.data) {
    return <ScreenFrame title="Comunidad"><LoadingState label="Cargando comunidad…" /></ScreenFrame>;
  }
  if (state.status === 'error' && !state.data) {
    return <ScreenFrame title="Comunidad"><ErrorState message={state.message} onRetry={() => void refresh()} /></ScreenFrame>;
  }
  const space = state.data;
  if (!space) return <ScreenFrame title="Comunidad"><Text>No hay datos disponibles.</Text></ScreenFrame>;

  return (
    <ScreenFrame title={space.name} subtitle={space.subtitle}>
      <View style={{ gap: paltaTheme.spacing.md }}>
        {space.membershipState !== 'active' ? (
          <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
            <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>{space.joinLabel}</Text>
            <Text style={{ marginTop: 4, color: paltaTheme.color.textSecondary }}>{space.joinDescription}</Text>
            {space.canJoin ? <PaltaButton label={space.joinActionLabel} onPress={() => void communityRuntime.joinSpace(space.id).then(refresh)} /> : null}
          </View>
        ) : null}

        {space.posts.map((post) => (
          <Pressable
            key={post.id}
            accessibilityRole="button"
            accessibilityLabel={`Abrir publicación de ${post.author}`}
            onPress={() => router.push(`/community/${space.id}/post/${post.id}`)}
            style={{ paddingVertical: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}
          >
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{post.author} · {post.timeLabel}</Text>
            <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 21, color: paltaTheme.color.textPrimary }}>{post.body}</Text>
            <Text style={{ marginTop: 10, fontSize: 13, color: paltaTheme.color.textSecondary }}>Comentarios {post.commentCount} · Reacciones {post.reactionCount}</Text>
          </Pressable>
        ))}
      </View>
    </ScreenFrame>
  );
}
