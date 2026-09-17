import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { CareTimeline } from '../../components/care/CareTimeline';
import { PaltaButton } from '../../components/common/PaltaButton';
import { SectionHeading } from '../../components/common/SectionHeading';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';

export default function CareTrackScreen() {
  const { careTrackId } = useLocalSearchParams<{ careTrackId: string }>();
  const [selectingBusinessId, setSelectingBusinessId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const loadCare = useCallback(async () => {
    if (!careTrackId) throw new Error('Care ID missing');
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    const [care, quote] = await Promise.all([
      mobileRuntime.client.getCare(careTrackId),
      mobileRuntime.client.quotes.getQuoteByCareTrack(careTrackId),
    ]);
    return { care, quote };
  }, [careTrackId]);

  const { state, refresh } = useAsyncResource(loadCare);

  async function selectBusiness(quoteId: string, businessId: string) {
    if (mobileRuntime.status !== 'ready') return;
    setSelectingBusinessId(businessId);
    setSelectionError(null);
    try {
      await mobileRuntime.client.quotes.selectBusiness(quoteId, businessId);
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
