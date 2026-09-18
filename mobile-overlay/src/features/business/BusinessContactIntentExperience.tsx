import { useCallback, useMemo, useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { BusinessApiDetail } from '../../../../src/api/paltaApiClient';
import { createClientMutationId } from '../../../../src/api/retryPolicy';
import {
  buildBusinessMessagingConversationSeed,
  type BusinessMessagingIntent,
} from '../../../../src/business/businessMessagingIntent';
import { ErrorState, LoadingState } from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { PaltaButton } from '../../components/common/PaltaButton';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';

export type BusinessContactIntentMode = 'inquiry' | 'reservation';

type PreparedReservation = {
  requestedForIso: string;
  contextType: 'booking';
  purposeKey: string;
};

function buildWhatsappBaseUrl(business: BusinessApiDetail): string | undefined {
  const publicLink = business.channel_links?.find((link) => link.provider === 'whatsapp')?.url;
  if (publicLink) return publicLink;

  const raw = business.contact?.whatsapp?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;
  const normalized = digits.startsWith('56')
    ? digits
    : digits.length === 9 && digits.startsWith('9')
      ? `56${digits}`
      : digits;
  return `https://wa.me/${normalized}`;
}

function appendWhatsappText(baseUrl: string, text: string): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('text', text);
    return url.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}text=${encodeURIComponent(text)}`;
  }
}

function reservationInitialText(
  businessName: string,
  requestedFor: string,
  note: string,
): string {
  return [
    `Hola, quisiera solicitar una reserva en ${businessName}.`,
    `Fecha y hora preferida: ${requestedFor}.`,
    note ? `Detalle: ${note}` : undefined,
    '¿Me pueden confirmar disponibilidad, por favor?',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

export function BusinessContactIntentExperience({
  mode,
}: {
  mode: BusinessContactIntentMode;
}) {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [text, setText] = useState('');
  const [requestedFor, setRequestedFor] = useState('');
  const [openingChannel, setOpeningChannel] = useState(false);
  const [creatingCare, setCreatingCare] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preparedReservation, setPreparedReservation] = useState<PreparedReservation | null>(null);
  const [careMutationId, setCareMutationId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.getBusiness(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);
  const business = state.data;
  const whatsappBaseUrl = useMemo(
    () => (business ? buildWhatsappBaseUrl(business) : undefined),
    [business],
  );

  function resetPreparedReservation() {
    setPreparedReservation(null);
    setCareMutationId(null);
    setMessage(null);
  }

  function updateText(value: string) {
    setText(value);
    if (mode === 'reservation') resetPreparedReservation();
  }

  function updateRequestedFor(value: string) {
    setRequestedFor(value);
    resetPreparedReservation();
  }

  async function openWhatsapp() {
    if (!business || !businessId) return;
    if (!whatsappBaseUrl) {
      setMessage('Este negocio todavía no tiene un canal de WhatsApp disponible en Palta.');
      return;
    }

    const cleanText = text.trim();
    let intent: BusinessMessagingIntent = 'general_inquiry';
    let initialText = cleanText;
    let requestedForIso: string | undefined;

    if (mode === 'inquiry') {
      if (cleanText.length < 2) {
        setMessage('Escribe brevemente qué quieres consultar.');
        return;
      }
    } else {
      const requestedForValue = requestedFor.trim();
      if (!requestedForValue) {
        setMessage('Indica una fecha y hora preferida para solicitar la reserva.');
        return;
      }
      const parsed = Date.parse(requestedForValue);
      if (!Number.isFinite(parsed)) {
        setMessage('La fecha no se pudo entender. Usa un formato como 2026-09-20 15:00.');
        return;
      }
      if (parsed <= Date.now()) {
        setMessage('La fecha y hora de la reserva debe estar en el futuro.');
        return;
      }
      requestedForIso = new Date(parsed).toISOString();
      intent = 'reservation_question';
      initialText = reservationInitialText(business.name, requestedForValue, cleanText);
    }

    const seed = buildBusinessMessagingConversationSeed({
      businessId,
      businessName: business.name,
      intent,
      initialText,
    });

    setOpeningChannel(true);
    setMessage(null);
    try {
      await Linking.openURL(appendWhatsappText(whatsappBaseUrl, seed.initialText ?? initialText));
      if (mode === 'reservation' && requestedForIso && seed.contextType === 'booking') {
        setPreparedReservation({
          requestedForIso,
          contextType: seed.contextType,
          purposeKey: seed.purposeKey,
        });
        setMessage(
          'Cuando vuelvas de WhatsApp, confirma aquí sólo si realmente enviaste la solicitud. La reserva aún depende de la confirmación del negocio.',
        );
      } else {
        setMessage('Abrimos WhatsApp con tu consulta preparada.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No pudimos abrir WhatsApp: ${error.message}`
          : 'No pudimos abrir WhatsApp.',
      );
    } finally {
      setOpeningChannel(false);
    }
  }

  async function confirmReservationSent() {
    if (!businessId || !preparedReservation || mobileRuntime.status !== 'ready') return;
    const mutationId = careMutationId ?? createClientMutationId(Date.now(), Math.random());
    if (!careMutationId) setCareMutationId(mutationId);

    setCreatingCare(true);
    setMessage(null);
    try {
      const care = await mobileRuntime.client.createCare({
        intentKey: 'local_business_reservation_request',
        subjectEntityId: businessId,
        actionType: 'external_reservation_request_sent',
        payload: {
          channel: 'whatsapp',
          requested_for: preparedReservation.requestedForIso,
          messaging_context_type: preparedReservation.contextType,
          messaging_purpose_key: preparedReservation.purposeKey,
        },
        idempotencyKey: mutationId,
      });
      router.replace(`/care/${encodeURIComponent(care.id)}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `La solicitud se envió por WhatsApp, pero no pudimos iniciar el seguimiento: ${error.message}`
          : 'La solicitud se envió por WhatsApp, pero no pudimos iniciar el seguimiento.',
      );
    } finally {
      setCreatingCare(false);
    }
  }

  const title = mode === 'reservation' ? 'Solicitar reserva' : 'Consultar';

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title={title}>
        <LoadingState label="Cargando negocio…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title={title}>
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  if (!business) return null;

  return (
    <ScreenFrame title={title} subtitle={business.name}>
      <View style={{ gap: 16 }}>
        {mode === 'reservation' ? (
          <View style={{ gap: 7 }}>
            <Text style={{ fontWeight: '800' }}>Fecha y hora preferida</Text>
            <TextInput
              value={requestedFor}
              onChangeText={updateRequestedFor}
              placeholder="Ej.: 2026-09-20 15:00"
              style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}
            />
            <Text style={{ fontSize: 12, opacity: 0.58 }}>
              Esto es una solicitud. El negocio debe confirmar la reserva.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 7 }}>
          <Text style={{ fontWeight: '800' }}>
            {mode === 'reservation' ? 'Detalle (opcional)' : '¿Qué quieres consultar?'}
          </Text>
          <TextInput
            value={text}
            onChangeText={updateText}
            multiline
            maxLength={2000}
            placeholder={
              mode === 'reservation'
                ? 'Ej.: somos 4 personas y necesitamos una mesa interior'
                : 'Ej.: ¿Atienden este sábado en la tarde?'
            }
            style={{
              minHeight: mode === 'reservation' ? 96 : 130,
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              textAlignVertical: 'top',
            }}
          />
          <Text style={{ fontSize: 12, opacity: 0.55 }}>{text.length}/2000</Text>
        </View>

        <View style={{ borderWidth: 1, borderRadius: 14, padding: 13, gap: 5 }}>
          <Text style={{ fontWeight: '800' }}>Canal actual</Text>
          <Text style={{ opacity: 0.64, lineHeight: 20 }}>
            {whatsappBaseUrl
              ? 'Palta prepara el mensaje y abre el WhatsApp público de este negocio. No creamos un segundo perfil ni copiamos la conversación.'
              : 'Este negocio todavía no tiene WhatsApp público conectado. No inventaremos un canal alternativo.'}
          </Text>
        </View>

        <PaltaButton
          label={
            openingChannel
              ? 'Abriendo WhatsApp…'
              : mode === 'reservation'
                ? 'Abrir WhatsApp para solicitar'
                : 'Abrir WhatsApp'
          }
          disabled={openingChannel || creatingCare || !whatsappBaseUrl}
          onPress={() => void openWhatsapp()}
        />

        {mode === 'reservation' && preparedReservation ? (
          <View style={{ gap: 10 }}>
            <PaltaButton
              label={creatingCare ? 'Iniciando seguimiento…' : 'Ya envié la solicitud'}
              disabled={creatingCare}
              onPress={() => void confirmReservationSent()}
            />
            <Text style={{ fontSize: 12, opacity: 0.6, lineHeight: 18 }}>
              Al confirmar, Palta crea un Care track ligado al mismo Business ID. No marca la reserva como confirmada: sólo conserva que enviaste la solicitud y queda pendiente la respuesta del negocio.
            </Text>
          </View>
        ) : null}

        {message ? <Text style={{ opacity: 0.72, lineHeight: 20 }}>{message}</Text> : null}

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
