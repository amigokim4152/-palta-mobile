import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';

export default function BusinessOwnerReviewsScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const [business, reviews] = await Promise.all([
      mobileRuntime.client.getBusiness(businessId),
      mobileRuntime.client.reviews.getBusinessReviews(businessId),
    ]);
    return { business, reviews };
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);

  async function submitReply(reviewId: string) {
    if (!businessId || mobileRuntime.status !== 'ready' || !replyBody.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await mobileRuntime.client.reviews.replyToBusinessReview(
        businessId,
        reviewId,
        replyBody,
      );
      setReplyingTo(null);
      setReplyBody('');
      setMessage('Respuesta publicada.');
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No pudimos publicar la respuesta: ${error.message}`
          : 'No pudimos publicar la respuesta.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Opiniones">
        <LoadingState label="Cargando opiniones…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Opiniones">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const business = state.data?.business;
  const reviews = state.data?.reviews;
  if (!business || !reviews) return null;

  if (business.verification_status !== 'verified') {
    return (
      <ScreenFrame title="Opiniones" subtitle={business.name}>
        <Text style={{ lineHeight: 20, opacity: 0.7 }}>
          Sólo el propietario verificado puede publicar una respuesta oficial del negocio.
        </Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Opiniones" subtitle={business.name}>
      <View style={{ gap: 12 }}>
        <Text style={{ opacity: 0.68, lineHeight: 20 }}>
          Las opiniones visibles aquí están vinculadas a una atención confirmada. Responde sólo cuando aporte contexto útil al cliente.
        </Text>

        {!reviews.items.length ? (
          <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}>
            <Text style={{ fontWeight: '800' }}>Todavía no hay opiniones verificadas</Text>
            <Text style={{ opacity: 0.66 }}>No necesitas hacer nada por ahora.</Text>
          </View>
        ) : null}

        {reviews.items.map((review) => {
          const editing = replyingTo === review.id;
          return (
            <View key={review.id} style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 7 }}>
              <Text style={{ fontWeight: '800' }}>
                {review.author_label} · {'★'.repeat(Math.max(1, Math.min(5, Math.round(review.rating))))}
              </Text>
              <Text style={{ fontSize: 12, opacity: 0.6 }}>
                Atención verificada · {review.evidence_label}
              </Text>
              {review.body ? <Text style={{ lineHeight: 20 }}>{review.body}</Text> : null}

              {review.business_reply ? (
                <View style={{ marginTop: 4, paddingLeft: 10, borderLeftWidth: 2, gap: 3 }}>
                  <Text style={{ fontWeight: '700' }}>Tu respuesta</Text>
                  <Text style={{ lineHeight: 20 }}>{review.business_reply.body}</Text>
                </View>
              ) : null}

              {editing ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <TextInput
                    value={replyBody}
                    onChangeText={setReplyBody}
                    multiline
                    maxLength={2000}
                    placeholder="Escribe una respuesta breve y útil"
                    style={{ minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 11, textAlignVertical: 'top' }}
                  />
                  <Pressable
                    disabled={submitting || !replyBody.trim()}
                    onPress={() => void submitReply(review.id)}
                    style={{ borderWidth: 1, borderRadius: 12, padding: 11, opacity: submitting || !replyBody.trim() ? 0.5 : 1 }}
                  >
                    <Text style={{ textAlign: 'center', fontWeight: '800' }}>
                      {submitting ? 'Publicando…' : review.business_reply ? 'Actualizar respuesta' : 'Responder'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={submitting}
                    onPress={() => {
                      setReplyingTo(null);
                      setReplyBody('');
                    }}
                    style={{ paddingVertical: 7 }}
                  >
                    <Text style={{ textAlign: 'center', opacity: 0.65 }}>Cancelar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setReplyingTo(review.id);
                    setReplyBody(review.business_reply?.body ?? '');
                    setMessage(null);
                  }}
                  style={{ borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 4 }}
                >
                  <Text style={{ textAlign: 'center', fontWeight: '800' }}>
                    {review.business_reply ? 'Editar respuesta' : 'Responder'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {message ? <Text style={{ opacity: 0.7, lineHeight: 20 }}>{message}</Text> : null}
      </View>
    </ScreenFrame>
  );
}
