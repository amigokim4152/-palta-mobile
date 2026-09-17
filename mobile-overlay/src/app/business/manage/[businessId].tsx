import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { SectionHeading } from '../../../components/common/SectionHeading';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../services/paltaClient';

function OwnerCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}>
      <Text style={{ fontSize: 17, fontWeight: '800' }}>{title}</Text>
      <Text style={{ opacity: 0.68, lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

export default function BusinessOwnerHomeScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();

  const loadBusiness = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.getBusiness(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(loadBusiness);

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Mi negocio">
        <LoadingState label="Cargando tu negocio…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Mi negocio">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const business = state.data;
  if (!business) return null;

  const verificationText =
    business.verification_status === 'verified'
      ? 'Propietario verificado'
      : business.verification_status === 'claimed'
        ? 'Verificación de propietario pendiente'
        : 'Este negocio todavía no está verificado';

  return (
    <ScreenFrame
      title={business.name}
      subtitle="Mi negocio"
      action={
        <Pressable onPress={() => router.push(`/business/${encodeURIComponent(business.id)}`)} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '800' }}>Ver perfil</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 14 }}>
        <OwnerCard title="Estado" body={verificationText} />

        <SectionHeading
          title="Tu perfil público"
          subtitle="Mantén primero correcta la información que el vecino necesita para decidir."
        />
        <OwnerCard
          title="Información básica"
          body={[business.category_key, business.opening_status, business.contact?.whatsapp ? 'WhatsApp' : undefined, business.contact?.phone ? 'Teléfono' : undefined]
            .filter(Boolean)
            .join(' · ') || 'Completa categoría, horario y forma de contacto.'}
        />

        <SectionHeading
          title="Lo que requiere atención"
          subtitle="Palta mostrará aquí sólo tareas reales, no un panel lleno por llenar."
        />
        {business.verification_status !== 'verified' ? (
          <OwnerCard
            title="Completa la verificación"
            body="Los precios, promociones y otras acciones controladas permanecen restringidas hasta confirmar la relación con el negocio."
          />
        ) : (
          <OwnerCard
            title="Perfil activo"
            body="No hay una tarea crítica pendiente en este momento."
          />
        )}

        <SectionHeading
          title="Después"
          subtitle="Servicios, consultas, reservas, cotizaciones, promociones y visibilidad aparecerán sólo cuando estén habilitados para este negocio."
        />
      </View>
    </ScreenFrame>
  );
}
