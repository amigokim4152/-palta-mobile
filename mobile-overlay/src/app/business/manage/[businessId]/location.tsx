import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';
import type { BusinessPublicLocationPrecisionApi } from '../../../../../../src/api/businessLocationApiClient';

const precisionOptions: Array<{
  value: BusinessPublicLocationPrecisionApi;
  title: string;
  body: string;
}> = [
  {
    value: 'exact',
    title: 'Ubicación exacta',
    body: 'Úsala para un local o punto fijo donde quieres que la gente llegue directamente.',
  },
  {
    value: 'area_only',
    title: 'Sólo zona',
    body: 'Muestra la zona o dirección general sin publicar el punto exacto.',
  },
  {
    value: 'hidden',
    title: 'No mostrar ubicación',
    body: 'Útil si trabajas a domicilio o desde una dirección privada. Tus zonas de atención pueden seguir visibles.',
  },
];

export default function BusinessOwnerLocationScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [addressLabel, setAddressLabel] = useState('');
  const [publicPrecision, setPublicPrecision] = useState<BusinessPublicLocationPrecisionApi>('exact');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.location.getOwnerLocation(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);

  useEffect(() => {
    const location = state.data;
    if (!location || initializedFor === location.business_id) return;
    setAddressLabel(location.address_label ?? '');
    setPublicPrecision(location.public_precision);
    setInitializedFor(location.business_id);
  }, [state.data, initializedFor]);

  async function save() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await mobileRuntime.client.location.updateOwnerLocation(businessId, {
        addressLabel,
        publicPrecision,
      });
      setAddressLabel(updated.address_label ?? '');
      setPublicPrecision(updated.public_precision);
      setMessage('Ubicación pública actualizada.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? `No pudimos guardar: ${error.message}` : 'No pudimos guardar la ubicación.');
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Ubicación">
        <LoadingState label="Cargando ubicación…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Ubicación">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const location = state.data;
  if (!location) return null;

  return (
    <ScreenFrame title="Ubicación" subtitle="Controla qué ve una persona en tu perfil">
      <View style={{ gap: 16 }}>
        <View style={{ gap: 7 }}>
          <Text style={{ fontWeight: '800' }}>Dirección o referencia pública</Text>
          <TextInput
            value={addressLabel}
            onChangeText={setAddressLabel}
            maxLength={240}
            placeholder="Ej.: Av. Ejemplo 123, Vitacura o simplemente Vitacura"
            style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}
          />
          <Text style={{ fontSize: 12, opacity: 0.58, lineHeight: 18 }}>
            Puedes usar una dirección completa para un local o sólo una zona si no quieres publicar una dirección privada.
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '800' }}>Qué tan precisa será la ubicación pública</Text>
          {precisionOptions.map((option) => {
            const selected = publicPrecision === option.value;
            return (
              <Pressable
                key={option.value}
                disabled={saving}
                onPress={() => setPublicPrecision(option.value)}
                style={{ borderWidth: selected ? 2 : 1, borderRadius: 12, padding: 12, gap: 4 }}
              >
                <Text style={{ fontWeight: '800' }}>{option.title}</Text>
                <Text style={{ opacity: 0.64, lineHeight: 19 }}>{option.body}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 5 }}>
          <Text style={{ fontWeight: '800' }}>Punto del mapa</Text>
          {location.anchor_point ? (
            <Text style={{ opacity: 0.66, lineHeight: 20 }}>
              Hay un punto guardado para este negocio. No te pediremos escribir coordenadas manualmente.
            </Text>
          ) : (
            <Text style={{ opacity: 0.66, lineHeight: 20 }}>
              Todavía no hay un punto confirmado para este negocio.
            </Text>
          )}
          <Text style={{ opacity: 0.58, lineHeight: 19 }}>
            El punto exacto se ajustará desde el selector de mapa cuando esté conectado. La dirección escrita arriba no moverá el punto por sí sola.
          </Text>
        </View>

        {location.service_area_labels.length ? (
          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: '800' }}>Zonas de atención</Text>
            <Text style={{ opacity: 0.66, lineHeight: 20 }}>
              {location.service_area_labels.join(' · ')}
            </Text>
          </View>
        ) : null}

        <Pressable
          disabled={saving}
          onPress={() => void save()}
          style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: saving ? 0.5 : 1 }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>
            {saving ? 'Guardando…' : 'Guardar ubicación pública'}
          </Text>
        </Pressable>

        {message ? <Text style={{ opacity: 0.72, lineHeight: 20 }}>{message}</Text> : null}
        {state.status === 'error' ? <ErrorState message={state.message} onRetry={() => void refresh()} /> : null}
      </View>
    </ScreenFrame>
  );
}
