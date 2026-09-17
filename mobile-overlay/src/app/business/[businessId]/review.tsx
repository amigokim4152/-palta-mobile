import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../services/paltaClient';

export default function BusinessReviewWriteScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const [business, eligibility] = await Promise.all([
      mobileRuntime.client.getBusiness(businessId),
      mobileRuntime.client.reviews.getMyReviewEligibility(businessId),
    ]);
    return { business, eligibility };
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);

  async function submit() {
    if (!businessId || mobileRuntime.status !== 'ready' || !state.data?.eligibility.eligible) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const evidence = state.data.eligibility.evidence;
      await mobileRuntime.client.reviews.createBusinessReview(businessId, {
        rating,
        ...(body.trim() ? { body: body.trim() } : {}),
        evidenceKind: evidence.kind,
        evidenceReferenceId: evidence.reference_id,
      });
      router.replace(`/business/${encodeURIComponent(businessId)}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No pudimos publicar tu opinión: ${error.message}`
          : 'No pudimos publicar tu opinión.',
      );
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Tu opinión">
        <LoadingState label="Comprobando tu atención…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Tu opinión">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const business = state.data?.business;
  const eligibility = state.data?.eligibility;
  if (!business || !eligibility) return null;

  if (!eligibility.eligible) {
    return (
      <ScreenFrame title="Tu opinión" subtitle={business.name}>
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>
            {eligibility.reason === 'already_reviewed'
              ? 'Ya dejaste una opinión por esta atención'
              : 'Todavía no hay una atención verificada para opinar'}
          </Text>
          <Text style={{ opacity: 0.68, lineHeight: 20 }}>
            Palta abre la opinión sólo cuando puede vincularla a una reserva, pedido, cotización, servicio o atención confirmada.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}
          >
            <Text style={{ textAlign: 'center', fontWeight: '800' }}>Volver</Text>
          </Pressable>
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Tu opinión" subtitle={business.name}>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 5 }}>
          <Text style={{ fontWeight: '800' }}>Atención verificada</Text>
          <Text style={{ opacity: 0.66 }}>
            {eligibility.evidence.label} · {new Date(eligibility.completed_at).toLocaleDateString('es-CL')}
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '800' }}>¿Cómo fue tu experiencia?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => setRating(value)}
                style={{
                  borderWidth: rating === value ? 2 : 1,
                  borderRadius: 999,
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 19, fontWeight: '800' }}>{value}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={{ fontWeight: '800' }}>Cuéntanos algo útil (opcional)</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            placeholder="¿Qué te ayudó a decidir? ¿Cómo fue la atención o el servicio?"
            style={{ minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' }}
          />
          <Text style={{ fontSize: 12, opacity: 0.55 }}>{body.length}/2000</Text>
        </View>

        <Text style={{ opacity: 0.62, lineHeight: 20 }}>
          Tu opinión se mostrará como atención verificada. Palta no publica tu identificador interno de usuario en la ficha del negocio.
        </Text>

        <Pressable
          disabled={submitting}
          onPress={() => void submit()}
          style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: submitting ? 0.5 : 1 }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>
            {submitting ? 'Publicando…' : 'Publicar opinión'}
          </Text>
        </Pressable>

        {message ? <Text style={{ opacity: 0.7, lineHeight: 20 }}>{message}</Text> : null}
      </View>
    </ScreenFrame>
  );
}
