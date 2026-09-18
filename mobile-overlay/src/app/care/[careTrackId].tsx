import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { BusinessReservationApiDetail } from '../../../../../src/api/businessReservationsApiClient';
import {
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { CareTimeline } from '../../components/care/CareTimeline';
import { PaltaButton } from '../../components/common/PaltaButton';
import { SectionHeading } from '../../components/common/SectionHeading';
import { getBusinessAuthenticatedRuntime } from '../../features/business/authenticatedBusinessRuntime';
import { useAsyncResource } from '../../hooks/useAsyncResource';

function reservationTitle(reservation: BusinessReservationApiDetail): string {
  switch (reservation.status) {
    case 'confirmed': return 'Reserva confirmada';
    case 'declined': return 'No hay disponibilidad';
    case 'cancelled': return 'Solicitud cancelada';
    default: return 'Esperando confirmación del negocio';
  }
}

function reservationBody(reservation: BusinessReservationApiDetail): string {
  switch (reservation.status) {
    case 'confirmed':
      return 'El negocio confirmó esta reserva. Palta conserva la misma solicitud y el mismo seguimiento.';
    case 'declined':
      return 'El negocio indicó que no puede confirmar esta solicitud. Puedes volver al perfil para buscar otra alternativa.';
    case 'cancelled':
      return 'Esta solicitud ya no está activa.';
    default:
      return 'La solicitud fue enviada, pero todavía no es una reserva confirmada. Falta la respuesta real del negocio.';
  }
}

export default function CareTrackScreen() {
  const { careTrackId } = useLocalSearchParams<{ careTrackId: string }>();
  const [selectingBusinessId, setSelectingBusinessId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const loadCare = useCallback(async () => {
    if (!careTrackId) throw new Error('Care ID missing');
    const authenticatedRuntime = getBusinessAuthenticatedRuntime();
    if (authenticatedRuntime.status !== 'ready') {
      throw new Error(authenticatedRuntime.message);
    }

    const [care, reservation] = await Promise.all([
      authenticatedRuntime.client.getCare(careTrackId),
      authenticatedRuntime.client.reservations.getByCareTrack(careTrackId),
    ]);

    // A Care track belongs to one concrete workflow. Do not make reservation
    // tracking depend on quote routes, and do not create a second Care object.
    const quote = reservation
      ? null
      : await authenticatedRuntime.client.quotes.getQuoteByCareTrack(careTrackId);

    return { care, quote, reservation };
  }, [careTrackId]);

  const { state, refresh } = useAsyncResource(loadCare);

  async function selectBusiness(quoteId: string, businessId: string) {
    const authenticatedRuntime = getBusinessAuthenticatedRuntime();
    if (authenticatedRuntime.status !== 'ready') {
      setSelectionError(authenticatedRuntime.message);
      return;
    }
    setSelectingBusinessId(businessId);
    setSelectionError(null);
    try {
      await authenticatedRuntime.client.quotes.selectBusiness(quoteId, businessId);
      await refresh();
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : 'No pudimos seleccionar este negocio.',
      );
    } finally {
      setSelectingBusinessId(null);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Seguimiento">
        <LoadingState label="Cargando seguimiento…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Seguimiento">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const care = state.data?.care;
  const quote = state.data?.quote;
  const reservation = state.data?.reservation;
  if (!care) {
    return (
      <ScreenFrame title="Seguimiento">
        <Text>No hay datos disponibles.</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Seguimiento" subtitle={care.intent_key}>
      <View style={{ gap: 16 }}>
        <SectionHeading
          eyebrow="SEGUIMIENTO"
          title={`Estado: ${care.state.toUpperCase()}`}
          subtitle="Palta conserva el proceso hasta resultado y seguimiento."
        />
        <CareTimeline state={care.state} />
        {care.waiting_for ? <Text>Esperando: {care.waiting_for}</Text> : null}
        {care.expected_at ? (
          <Text>Fecha estimada: {new Date(care.expected_at).toLocaleString('es-CL')}</Text>
        ) : null}

        {reservation ? (
          <View style={{ gap: 10, borderWidth: 1, borderRadius: 14, padding: 14 }}>
            <SectionHeading
              eyebrow="RESERVA"
              title={reservationTitle(reservation)}
              subtitle={reservationBody(reservation)}
            />
            <Text style={{ fontWeight: '800' }}>
              Solicitada para: {new Date(reservation.requested_for).toLocaleString('es-CL')}
            </Text>
            {reservation.note ? <Text style={{ lineHeight: 20 }}>{reservation.note}</Text> : null}
            {reservation.owner_note ? (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', opacity: 0.58 }}>RESPUESTA DEL NEGOCIO</Text>
                <Text style={{ lineHeight: 20 }}>{reservation.owner_note}</Text>
              </View>
            ) : null}
            {reservation.responded_at ? (
              <Text style={{ fontSize: 12, opacity: 0.58 }}>
                Respondido: {new Date(reservation.responded_at).toLocaleString('es-CL')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {quote ? (
          <View style={{ gap: 12 }}>
            <SectionHeading
              eyebrow="COTIZACIÓN"
              title="Respuestas recibidas"
              subtitle={quote.description}
            />

            {quote.responses.length === 0 ? (
              <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}>
                <Text style={{ fontWeight: '800' }}>Todavía estamos esperando respuestas</Text>
                <Text style={{ opacity: 0.64, lineHeight: 20 }}>
                  No necesitas volver a enviar la solicitud. Las respuestas aparecerán aquí cuando lleguen.
                </Text>
              </View>
            ) : (
              quote.responses.map((response) => {
                const locked = quote.status === 'selected' || quote.status === 'completed';
                return (
                  <View
                    key={response.id}
                    style={{ borderWidth: response.selected ? 2 : 1, borderRadius: 14, padding: 14, gap: 7 }}
                  >
                    <Text style={{ fontWeight: '800', fontSize: 16 }}>{response.business_name}</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800' }}>
                      {response.amount_clp !== undefined
                        ? `${response.amount_clp.toLocaleString('es-CL')} CLP`
                        : 'Precio por confirmar'}
                    </Text>
                    {response.note ? <Text style={{ lineHeight: 20 }}>{response.note}</Text> : null}
                    {response.available_at ? (
                      <Text style={{ opacity: 0.65 }}>
                        Disponible: {new Date(response.available_at).toLocaleString('es-CL')}
                      </Text>
                    ) : null}
                    {response.valid_until ? (
                      <Text style={{ opacity: 0.65 }}>
                        Válida hasta: {new Date(response.valid_until).toLocaleString('es-CL')}
                      </Text>
                    ) : null}
                    {response.selected ? (
                      <Text style={{ fontWeight: '800' }}>Negocio seleccionado</Text>
                    ) : !locked ? (
                      <Pressable
                        disabled={selectingBusinessId !== null}
                        onPress={() => void selectBusiness(quote.id, response.business_id)}
                        style={{ borderWidth: 1, borderRadius: 11, padding: 11, opacity: selectingBusinessId ? 0.55 : 1 }}
                      >
                        <Text style={{ textAlign: 'center', fontWeight: '800' }}>
                          {selectingBusinessId === response.business_id ? 'Seleccionando…' : 'Elegir este negocio'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}

            {selectionError ? <Text style={{ opacity: 0.72 }}>{selectionError}</Text> : null}
          </View>
        ) : null}

        <Text style={{ opacity: 0.55 }}>Care ID: {care.id}</Text>

        <PaltaButton
          label="Actualizar estado"
          variant="secondary"
          onPress={() => void refresh()}
        />

        <PaltaButton
          label="Volver a Inicio"
          onPress={() => router.replace('/(tabs)/home')}
        />

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
