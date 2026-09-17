import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';

const fieldLabels: Record<string, string> = {
  name: 'Nombre',
  category: 'Categoría',
  description: 'Descripción',
  address: 'Dirección',
  location: 'Ubicación',
  service_area: 'Zona de atención',
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  hours: 'Horario',
  services: 'Servicios',
  channel_link: 'Enlace externo',
  lifecycle: 'Estado del negocio',
};

const reasonLabels: Record<string, string> = {
  wrong_value: 'Dato incorrecto',
  outdated: 'Información desactualizada',
  temporarily_changed: 'Cambio temporal',
  business_moved: 'Posible cambio de dirección',
  business_closed: 'Posible cierre del negocio',
  other: 'Otro motivo',
};

export default function BusinessOwnerCorrectionsScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.corrections.getOwnerBusinessCorrections(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Información por revisar">
        <LoadingState label="Cargando avisos…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Información por revisar">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const items = state.data?.items ?? [];

  return (
    <ScreenFrame
      title="Información por revisar"
      subtitle="Avisos de personas que encontraron un dato que podría estar incorrecto"
    >
      <View style={{ gap: 12 }}>
        <Text style={{ opacity: 0.68, lineHeight: 20 }}>
          Un aviso no cambia tu perfil automáticamente. Revísalo y actualiza la información sólo si corresponde.
        </Text>

        {!items.length ? (
          <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}>
            <Text style={{ fontWeight: '800' }}>No hay avisos pendientes</Text>
            <Text style={{ opacity: 0.66 }}>Tu negocio no tiene correcciones pendientes en este momento.</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={item.id} style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', opacity: 0.58 }}>POR REVISAR</Text>
            <Text style={{ fontSize: 17, fontWeight: '800' }}>
              {fieldLabels[item.field] ?? item.field}
            </Text>
            <Text style={{ opacity: 0.7 }}>{reasonLabels[item.reason] ?? item.reason}</Text>
            {item.note ? <Text style={{ lineHeight: 20 }}>{item.note}</Text> : null}
            <Text style={{ fontSize: 12, opacity: 0.5 }}>
              Recibido {new Date(item.reported_at).toLocaleString('es-CL')}
            </Text>

            {item.field === 'hours' && businessId ? (
              <Pressable
                onPress={() =>
                  router.push(`/business/manage/${encodeURIComponent(businessId)}/hours`)
                }
                style={{ marginTop: 4, borderWidth: 1, borderRadius: 12, padding: 11 }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '800' }}>Revisar horario</Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
