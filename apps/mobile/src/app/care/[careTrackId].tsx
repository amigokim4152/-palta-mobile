import { useCallback } from 'react';
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

  const loadCare = useCallback(async () => {
    if (!careTrackId) throw new Error('Care ID missing');
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getCare(careTrackId);
  }, [careTrackId]);

  const { state, refresh } = useAsyncResource(loadCare);

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

  const care = state.data;
  if (!care) {
    return (
      <ScreenFrame title="Seguimiento">
        <Text>No hay datos disponibles.</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Seguimiento" subtitle={care.intent_key}>
      <View style={{ gap: 12 }}>
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
