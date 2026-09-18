import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ErrorState, LoadingState } from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const loadPlace = useCallback(async () => {
    if (!id) throw new Error('Place ID missing');
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getPlace(id);
  }, [id]);

  const { state, refresh } = useAsyncResource(loadPlace);

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Lugar">
        <LoadingState label="Cargando lugar…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Lugar">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const place = state.data;
  if (!place) {
    return (
      <ScreenFrame title="Lugar">
        <Text>No hay datos disponibles.</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title={place.name}
      subtitle={[place.place_type, place.category_key].filter(Boolean).join(' · ')}
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 5 }}>
          {place.address ? <Text>{place.address}</Text> : null}
          {place.commune || place.region ? (
            <Text style={{ opacity: 0.66 }}>
              {[place.commune, place.region].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>

        {place.service_labels?.length ? (
          <View style={{ gap: 5 }}>
            <SectionHeading title="Información" />
            <Text>{place.service_labels.join(' · ')}</Text>
          </View>
        ) : null}

        {place.contact && Object.keys(place.contact).length ? (
          <View style={{ gap: 5 }}>
            <SectionHeading title="Contacto público" />
            {place.contact.phone ? <Text>Teléfono: {place.contact.phone}</Text> : null}
            {place.contact.email ? <Text>Email: {place.contact.email}</Text> : null}
            {place.contact.website ? <Text>Web: {place.contact.website}</Text> : null}
            {place.contact.instagram ? <Text>Instagram: {place.contact.instagram}</Text> : null}
          </View>
        ) : null}

        <View style={{ gap: 5 }}>
          <Text>
            Información pública: {place.fact_verification_status ?? 'sin confirmar'}
          </Text>
          {place.evidence?.checked_at ? (
            <Text style={{ opacity: 0.6 }}>Datos revisados: {place.evidence.checked_at}</Text>
          ) : null}
        </View>

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}

        <Text style={{ opacity: 0.45 }}>Canonical ID: {place.id}</Text>
      </View>
    </ScreenFrame>
  );
}
