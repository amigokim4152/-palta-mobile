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
        <Pressable
          onPress={() => router.push(`/business/${encodeURIComponent(business.id)}`)}
          style={{ paddingVertical: 8 }}
        >
          <Text style={{ fontWeight: '800' }}>Ver perfil</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 14 }}>
        <OwnerCard title="Estado" body={verificationText} />

        <SectionHeading
          title="Tu base gratuita"
          subtitle="Primero mantén útil y correcta la información que el vecino necesita."
        />
        <OwnerCard
          title="Perfil público"
          body={[
            business.category_key,
            business.opening_status,
            business.contact?.whatsapp ? 'WhatsApp' : undefined,
            business.contact?.phone ? 'Teléfono' : undefined,
          ]
            .filter(Boolean)
            .join(' · ') || 'Completa categoría, horario y forma de contacto.'}
        />
        <Text style={{ opacity: 0.66, lineHeight: 20 }}>
          Tu presencia básica, la información pública y el descubrimiento orgánico no dependen de contratar un módulo adicional.
        </Text>

        <SectionHeading
          title="Lo que requiere atención"
          subtitle="Palta muestra tareas reales, no un panel lleno por llenar."
        />
        {business.verification_status !== 'verified' ? (
          <OwnerCard
            title="Completa la verificación"
            body="Confirma tu relación con el negocio para poder controlar información sensible y activar funciones que requieren autorización del propietario."
          />
        ) : (
          <OwnerCard
            title="Perfil activo"
            body="No hay una tarea crítica pendiente en este momento."
          />
        )}

        <SectionHeading
          title="Haz más fácil tu trabajo"
          subtitle="Las herramientas adicionales aparecen cuando sirven para una necesidad real de tu negocio."
        />
        <OwnerCard
          title="Capacidades opcionales"
          body="Cotizaciones, reservas, pedidos, promociones, POS, inventario, CRM, equipo y automatización se conectan al mismo negocio. No necesitas volver a registrarte ni mantener otro perfil."
        />
        <Text style={{ opacity: 0.6, lineHeight: 20 }}>
          Que una función exista no define por sí solo su precio. Planes, límites y cobros deben venir de la política comercial vigente de Palta.
        </Text>
      </View>
    </ScreenFrame>
  );
}
