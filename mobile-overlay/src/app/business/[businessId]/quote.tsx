import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { createClientMutationId } from '../../../../../src/api/retryPolicy';
import { mobileRuntime } from '../../../services/paltaClient';

export default function BusinessQuoteRequestScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [description, setDescription] = useState('');
  const [requestedFor, setRequestedFor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.getBusiness(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);

  async function submit() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    const cleanDescription = description.trim();
    if (cleanDescription.length < 10) {
      setMessage('Describe un poco más lo que necesitas para que el negocio pueda cotizar.');
      return;
    }

    let requestedForIso: string | undefined;
    if (requestedFor.trim()) {
      const parsed = Date.parse(requestedFor.trim());
      if (!Number.isFinite(parsed)) {
        setMessage('La fecha no se pudo entender. Puedes dejarla vacía si todavía no sabes cuándo.');
        return;
      }
      requestedForIso = new Date(parsed).toISOString();
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const quote = await mobileRuntime.client.quotes.createQuoteRequest({
        description: cleanDescription,
        recipientBusinessIds: [businessId],
        ...(requestedForIso ? { requestedFor: requestedForIso } : {}),
        idempotencyKey: createClientMutationId(Date.now(), Math.random()),
      });
      router.replace(`/care/${encodeURIComponent(quote.care_track_id)}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No pudimos enviar la solicitud: ${error.message}`
          : 'No pudimos enviar la solicitud.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Pedir cotización">
        <LoadingState label="Cargando negocio…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Pedir cotización">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const business = state.data;
  if (!business) return null;

  return (
    <ScreenFrame title="Pedir cotización" subtitle={business.name}>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 7 }}>
          <Text style={{ fontWeight: '800' }}>¿Qué necesitas?</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
            placeholder="Ej.: hay una fuga bajo el lavaplatos y necesito revisar si hay que cambiar la llave"
            style={{ minHeight: 130, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' }}
          />
          <Text style={{ fontSize: 12, opacity: 0.55 }}>{description.length}/2000</Text>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={{ fontWeight: '800' }}>¿Para cuándo? (opcional)</Text>
          <TextInput
            value={requestedFor}
            onChangeText={setRequestedFor}
            placeholder="Ej.: 2026-09-20 15:00"
            style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}
          />
        </View>

        <View style={{ borderWidth: 1, borderRadius: 14, padding: 13, gap: 5 }}>
          <Text style={{ fontWeight: '800' }}>Fotos</Text>
          <Text style={{ opacity: 0.64, lineHeight: 20 }}>
            Se podrán adjuntar aquí cuando Shared Media esté conectado. Palta no creará un almacenamiento de fotos separado sólo para cotizaciones.
          </Text>
        </View>

        <Text style={{ opacity: 0.62, lineHeight: 20 }}>
          Palta crea una sola solicitud de cotización y la enlaza al Care flow compartido. El mismo contrato permite sumar más negocios después sin duplicar el seguimiento.
        </Text>

        <Pressable
          disabled={submitting || description.trim().length < 10}
          onPress={() => void submit()}
          style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: submitting || description.trim().length < 10 ? 0.5 : 1 }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>
            {submitting ? 'Enviando…' : 'Enviar solicitud'}
          </Text>
        </Pressable>

        {message ? <Text style={{ opacity: 0.7, lineHeight: 20 }}>{message}</Text> : null}
      </View>
    </ScreenFrame>
  );
}
