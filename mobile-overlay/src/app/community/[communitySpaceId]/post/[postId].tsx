import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { PaltaButton } from '../../../../components/common/PaltaButton';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { communityRuntime } from '../../../../features/community/communityRuntime';
import { paltaTheme } from '../../../../theme/paltaTheme';

export default function CommunityThreadScreen() {
  const { communitySpaceId, postId } = useLocalSearchParams<{ communitySpaceId: string; postId: string }>();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      await communityRuntime.addComment(communitySpaceId, postId, body);
      setComment('');
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenFrame title={thread.communityName} subtitle="Conversación">
      <View style={{ gap: paltaTheme.spacing.lg }}>
        <View style={{ paddingBottom: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{thread.post.author} · {thread.post.timeLabel}</Text>
          <Text style={{ marginTop: 8, fontSize: 17, lineHeight: 24, color: paltaTheme.color.textPrimary }}>{thread.post.body}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm, marginTop: paltaTheme.spacing.md }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Marcar como útil. ${thread.post.reactionCount} reacciones`}
              onPress={() => void communityRuntime.reactToPost(communitySpaceId, postId).then(refresh)}
              style={({ pressed }) => ({ minHeight: paltaTheme.touch.minimum, justifyContent: 'center', paddingHorizontal: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.surfaceMuted, opacity: pressed ? 0.72 : 1 })}
            >
              <Text style={{ color: paltaTheme.color.brandPrimary, fontWeight: '700' }}>Útil · {thread.post.reactionCount}</Text>
            </Pressable>
            <Text style={{ color: paltaTheme.color.textSecondary, fontSize: 13 }}>{thread.comments.length} comentarios</Text>
          </View>
        </View>

        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Comentarios</Text>
          {thread.comments.length === 0 ? <Text style={{ marginTop: paltaTheme.spacing.sm, color: paltaTheme.color.textSecondary }}>Todavía no hay comentarios.</Text> : null}
          {thread.comments.map((item) => (
            <View key={item.id} style={{ paddingVertical: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
                <Text style={{ flex: 1, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{item.author}</Text>
                <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{item.timeLabel}</Text>
              </View>
              <Text style={{ marginTop: 5, lineHeight: 21, color: paltaTheme.color.textPrimary }}>{item.body}</Text>
            </View>
          ))}
        </View>

        {thread.canComment ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Responder</Text>
            <TextInput
              accessibilityLabel="Escribe un comentario"
              value={comment}
              onChangeText={setComment}
              placeholder="Escribe un comentario"
              placeholderTextColor={paltaTheme.color.textMuted}
              multiline
              maxLength={2000}
              style={{ minHeight: 88, padding: paltaTheme.spacing.md, borderWidth: 1, borderColor: paltaTheme.color.divider, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface, color: paltaTheme.color.textPrimary, textAlignVertical: 'top' }}
            />
            <PaltaButton label={submitting ? 'Publicando…' : 'Comentar'} onPress={() => void submit()} disabled={!comment.trim() || submitting} />
          </View>
        ) : (
          <Text style={{ color: paltaTheme.color.textSecondary }}>Únete a esta comunidad para participar en la conversación.</Text>
        )}
      </View>
    </ScreenFrame>
  );
}
