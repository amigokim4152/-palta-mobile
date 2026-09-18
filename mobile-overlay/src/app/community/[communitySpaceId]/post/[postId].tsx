import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { PaltaButton } from '../../../../components/common/PaltaButton';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { communityRuntime } from '../../../../features/community/communityRuntime';
import { paltaTheme } from '../../../../theme/paltaTheme';

export default function CommunityThreadScreen() {
  const { communitySpaceId, postId } = useLocalSearchParams<{ communitySpaceId: string; postId: string }>();
  const [comment, setComment] = useState('');
  const load = useCallback(() => {
    if (!communitySpaceId || !postId) throw new Error('Community thread ID missing');
    return communityRuntime.loadPost(communitySpaceId, postId);
  }, [communitySpaceId, postId]);
  const { state, refresh } = useAsyncResource(load);

  if (state.status === 'loading' && !state.data) return <ScreenFrame title="Publicación"><LoadingState label="Cargando conversación…" /></ScreenFrame>;
  if (state.status === 'error' && !state.data) return <ScreenFrame title="Publicación"><ErrorState message={state.message} onRetry={() => void refresh()} /></ScreenFrame>;
  const thread = state.data;
  if (!thread) return <ScreenFrame title="Publicación"><Text>No hay datos disponibles.</Text></ScreenFrame>;

  const submit = async () => {
    const body = comment.trim();
    if (!body) return;
    await communityRuntime.addComment(communitySpaceId, postId, body);
    setComment('');
    await refresh();
  };

  return (
    <ScreenFrame title={thread.communityName} subtitle="Conversación">
      <View style={{ gap: paltaTheme.spacing.md }}>
        <View style={{ paddingBottom: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{thread.post.author} · {thread.post.timeLabel}</Text>
          <Text style={{ marginTop: 8, fontSize: 16, lineHeight: 23, color: paltaTheme.color.textPrimary }}>{thread.post.body}</Text>
          <PaltaButton label={`Me sirve · ${thread.post.reactionCount}`} variant="secondary" onPress={() => void communityRuntime.reactToPost(communitySpaceId, postId).then(refresh)} />
        </View>

        {thread.comments.map((item) => (
          <View key={item.id} style={{ paddingVertical: paltaTheme.spacing.sm, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}>
            <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>{item.author}</Text>
            <Text style={{ marginTop: 4, color: paltaTheme.color.textPrimary }}>{item.body}</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: paltaTheme.color.textMuted }}>{item.timeLabel}</Text>
          </View>
        ))}

        {thread.canComment ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Escribe un comentario"
              placeholderTextColor={paltaTheme.color.textMuted}
              multiline
              style={{ minHeight: 72, padding: paltaTheme.spacing.sm, borderWidth: 1, borderColor: paltaTheme.color.divider, borderRadius: paltaTheme.radius.surface, color: paltaTheme.color.textPrimary }}
            />
            <PaltaButton label="Comentar" onPress={() => void submit()} disabled={!comment.trim()} />
          </View>
        ) : null}
      </View>
    </ScreenFrame>
  );
}
