import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { SectionHeading } from '../../../components/common/SectionHeading';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../services/paltaClient';
import type { BusinessOperationalState } from '../../../../../src/business/businessOperationalState';

function operationalStateLabel(state?: BusinessOperationalState): string {
  switch (state) {
    case 'open_now': return 'Abierto ahora';
    case 'closed_now': return 'Cerrado ahora';
    case 'closed_today': return 'Cerrado hoy';
    case 'temporarily_closed': return 'Cerrado temporalmente';
    case 'seasonal_closed': return 'Cerrado por temporada';
    case 'paused': return 'Atención pausada';
    case 'permanently_closed': return 'Cerrado permanentemente';
    default: return 'Horario por confirmar';
  }
}

function OwnerCard({
  title,
  body,
  badge,
  onPress,
}: {
  title: string;
  body: string;
  badge?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      {badge ? <Text style={{ fontSize: 12, fontWeight: '800', opacity: 0.58 }}>{badge}</Text> : null}
      <Text style={{ fontSize: 17, fontWeight: '800' }}>{title}</Text>
      <Text style={{ opacity: 0.68, lineHeight: 20 }}>{body}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}>
      {content}
    </View>
  );
}

export default function BusinessOwnerHomeScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();

  const loadOwnerHome = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const [business, guidance, ownerCoupon] = await Promise.all([
      mobileRuntime.client.getBusiness(businessId),
      mobileRuntime.client.getOwnerBusinessGuidance(businessId),
      mobileRuntime.client.getOwnerBusinessBasicCoupon(businessId),
    ]);
    return { business, guidance, coupon: ownerCoupon.coupon };
  }, [businessId]);

  const { state, refresh } = useAsyncResource(loadOwnerHome);

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

  const business = state.data?.business;
  const guidance = state.data?.guidance;
  const ownerCoupon = state.data?.coupon;
  if (!business || !guidance) return null;

  const verificationText =
    business.verification_status === 'verified'
      ? 'Propietario verificado'
      : business.verification_status === 'claimed'
        ? 'Verificación de propietario pendiente'
        : 'Este negocio todavía no está verificado';

  const channelSummary = (business.channel_links ?? [])
    .map((channel) => channel.label)
    .join(' · ');
  const couponExpired = Boolean(
    ownerCoupon?.expires_at && Date.parse(ownerCoupon.expires_at) <= Date.now(),
  );
  const postCount = business.posts?.length ?? 0;
  const latestPost = business.posts?.[0];
  const operationalSummary = [
    operationalStateLabel(business.operational_state),
    business.hours_summary,
  ].filter(Boolean).join(' · ');

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
            business.contact?.whatsapp ? 'WhatsApp' : undefined,
            business.contact?.phone ? 'Teléfono' : undefined,
            ...(business.channel_links ?? []).slice(0, 2).map((channel) => channel.label),
          ]
            .filter(Boolean)
            .join(' · ') || 'Completa categoría, horario y forma de contacto.'}
        />
        <OwnerCard
          title="Horario y estado de hoy"
          body={operationalSummary || 'Configura tu horario normal. Palta calculará el estado de hoy automáticamente.'}
          badge="SIN COSTO"
          onPress={() =>
            router.push(`/business/manage/${encodeURIComponent(business.id)}/hours`)
          }
        />
        {business.verification_status === 'claimed' || business.verification_status === 'verified' ? (
          <OwnerCard
            title="Información por revisar"
            body="Mira avisos de personas que encontraron un horario, dirección, contacto u otro dato que podría estar incorrecto. Ningún aviso cambia tu perfil automáticamente."
            badge="SIN COSTO"
            onPress={() =>
              router.push(`/business/manage/${encodeURIComponent(business.id)}/corrections`)
            }
          />
        ) : null}
        <OwnerCard
          title="Enlaces públicos"
          body={channelSummary || 'Agrega Instagram, Facebook, TikTok, Google, WhatsApp o tu sitio. Sólo son enlaces: no necesitas conectar cuentas ni una API.'}
          badge="SIN COSTO"
          onPress={() =>
            router.push(`/business/manage/${encodeURIComponent(business.id)}/channels`)
          }
        />
        {business.verification_status === 'verified' ? (
          <>
            <OwnerCard
              title="Novedades"
              body={latestPost
                ? `${postCount} publicada${postCount === 1 ? '' : 's'} · Última: ${latestPost.title}`
                : 'Publica horarios especiales, disponibilidad o noticias concretas en el mismo perfil del negocio.'}
              badge="SIN COSTO"
              onPress={() =>
                router.push(`/business/manage/${encodeURIComponent(business.id)}/posts`)
              }
            />
            <OwnerCard
              title="Cupón básico"
              body={ownerCoupon
                ? `${couponExpired ? 'Vencido · ' : ''}${ownerCoupon.title}${ownerCoupon.audience === 'followers' ? ' · Sólo seguidores' : ' · Visible para todos'}`
                : 'Publica un beneficio simple sin pagar por una campaña, segmentación o automatización.'}
              badge="SIN COSTO"
              onPress={() =>
                router.push(`/business/manage/${encodeURIComponent(business.id)}/coupons`)
              }
            />
          </>
        ) : null}
        <Text style={{ opacity: 0.66, lineHeight: 20 }}>
          Tu presencia básica, el horario, las novedades, la información pública y el descubrimiento orgánico no dependen de contratar un módulo adicional.
        </Text>

        <SectionHeading
          title="Ahora conviene esto"
          subtitle="Palta prioriza tareas reales y mejoras gratuitas antes que venderte otra función."
        />
        {guidance.items.length ? (
          guidance.items.slice(0, 5).map((item) => (
            <OwnerCard
              key={item.id}
              title={item.title}
              body={item.reason}
              badge={item.commercial === 'free' ? 'SIN COSTO' : item.commercial === 'may_be_paid' ? 'OPCIONAL' : undefined}
            />
          ))
        ) : (
          <OwnerCard
            title="Todo tranquilo por ahora"
            body="No hay una tarea útil que Palta necesite ponerte delante en este momento."
          />
        )}

        <SectionHeading
          title="Haz más fácil tu trabajo"
          subtitle="Las herramientas adicionales aparecen cuando resuelven una necesidad real de tu negocio."
        />
        <OwnerCard
          title="Un mismo negocio, más herramientas cuando hagan falta"
          body="Cotizaciones, reservas, pedidos, POS, inventario, clientes, equipo y automatización se conectan al mismo negocio. No necesitas volver a registrarte ni mantener otro perfil."
        />
        <Text style={{ opacity: 0.6, lineHeight: 20 }}>
          Que una función exista no define por sí solo su precio. Planes, límites y cobros deben venir de la política comercial vigente de Palta.
        </Text>

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
