import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { OwnerPartnerCard } from '../../../components/business/OwnerPartnerCard';
import { SectionHeading } from '../../../components/common/SectionHeading';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../services/paltaClient';
import { paltaTheme } from '../../../theme/paltaTheme';
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

function operationalTone(state?: BusinessOperationalState) {
  if (state === 'open_now') return 'success' as const;
  if (
    state === 'temporarily_closed' ||
    state === 'seasonal_closed' ||
    state === 'paused' ||
    state === 'permanently_closed' ||
    state === 'unknown_or_stale'
  ) {
    return 'attention' as const;
  }
  return 'normal' as const;
}

type GuidanceTargetKind =
  | 'hours'
  | 'corrections'
  | 'profile'
  | 'services'
  | 'location'
  | 'channels'
  | 'posts'
  | 'coupons'
  | 'reviews';

function guidanceTargetKind(target: string): GuidanceTargetKind | undefined {
  const kinds: GuidanceTargetKind[] = [
    'hours',
    'corrections',
    'profile',
    'services',
    'location',
    'channels',
    'posts',
    'coupons',
    'reviews',
  ];
  return kinds.find((kind) => target.includes(`/${kind}`));
}

function openGuidanceTarget(businessId: string, kind: GuidanceTargetKind) {
  const id = encodeURIComponent(businessId);
  switch (kind) {
    case 'hours': return router.push(`/business/manage/${id}/hours`);
    case 'corrections': return router.push(`/business/manage/${id}/corrections`);
    case 'profile': return router.push(`/business/manage/${id}/profile`);
    case 'services': return router.push(`/business/manage/${id}/services`);
    case 'location': return router.push(`/business/manage/${id}/location`);
    case 'channels': return router.push(`/business/manage/${id}/channels`);
    case 'posts': return router.push(`/business/manage/${id}/posts`);
    case 'coupons': return router.push(`/business/manage/${id}/coupons`);
    case 'reviews': return router.push(`/business/manage/${id}/reviews`);
  }
}

export default function BusinessOwnerHomeScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();

  const loadOwnerHome = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);

    const business = await mobileRuntime.client.getBusiness(businessId);
    const ownerManaged =
      business.verification_status === 'claimed' ||
      business.verification_status === 'verified';
    const verified = business.verification_status === 'verified';

    const [guidance, ownerCoupon, corrections, reviews] = await Promise.all([
      mobileRuntime.client.getOwnerBusinessGuidance(businessId),
      mobileRuntime.client.getOwnerBusinessBasicCoupon(businessId),
      ownerManaged
        ? mobileRuntime.client.corrections.getOwnerBusinessCorrections(businessId)
        : Promise.resolve({ business_id: businessId, items: [] }),
      verified
        ? mobileRuntime.client.reviews.getBusinessReviews(businessId)
        : Promise.resolve({ business_id: businessId, summary: { count: 0 }, items: [] }),
    ]);

    return {
      business,
      guidance,
      coupon: ownerCoupon.coupon,
      correctionCount: corrections.items.length,
      reviewCount: reviews.summary.count,
      ownerManaged,
    };
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
  const correctionCount = state.data?.correctionCount ?? 0;
  const reviewCount = state.data?.reviewCount ?? 0;
  const ownerManaged = state.data?.ownerManaged ?? false;
  if (!business || !guidance) return null;

  const verificationText =
    business.verification_status === 'verified'
      ? 'Propietario verificado'
      : business.verification_status === 'claimed'
        ? 'Verificación de propietario pendiente'
        : 'Negocio aún no verificado';
  const channelSummary = (business.channel_links ?? [])
    .map((channel) => channel.label)
    .slice(0, 3)
    .join(' · ');
  const serviceSummary = (business.service_labels ?? []).slice(0, 3).join(' · ');
  const couponExpired = Boolean(
    ownerCoupon?.expires_at && Date.parse(ownerCoupon.expires_at) <= Date.now(),
  );
  const postCount = business.posts?.length ?? 0;
  const latestPost = business.posts?.[0];
  const operationalSummary = [
    operationalStateLabel(business.operational_state),
    business.hours_summary,
  ].filter(Boolean).join(' · ');

  const correctionTargets = guidance.items.filter(
    (item) => item.target.includes('/corrections'),
  );
  const actionItems = guidance.items.filter(
    (item) => item.action_required && !item.target.includes('/corrections'),
  );
  const freeSuggestions = guidance.items.filter(
    (item) =>
      !item.action_required &&
      item.commercial === 'free' &&
      !item.target.includes('/corrections'),
  );
  const paidSuggestions = guidance.items.filter(
    (item) => item.commercial === 'may_be_paid',
  );
  const hasAttention = correctionCount > 0 || actionItems.length > 0 || correctionTargets.length > 0;

  return (
    <ScreenFrame
      title={business.name}
      subtitle="Mi negocio"
      action={
        <Pressable
          onPress={() => router.push(`/business/${encodeURIComponent(business.id)}`)}
          style={{ paddingVertical: paltaTheme.spacing.xs }}
        >
          <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
            Ver perfil
          </Text>
        </Pressable>
      }
    >
      <View style={{ gap: paltaTheme.spacing.lg }}>
        <View style={{ gap: paltaTheme.spacing.xs }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
            <View
              style={{
                borderRadius: paltaTheme.radius.pill,
                paddingHorizontal: paltaTheme.spacing.xs,
                paddingVertical: paltaTheme.spacing.xxs,
                backgroundColor: business.verification_status === 'verified'
                  ? paltaTheme.color.brandSoft
                  : paltaTheme.color.surfaceMuted,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: business.verification_status === 'verified'
                    ? paltaTheme.color.brandPrimary
                    : paltaTheme.color.textSecondary,
                }}
              >
                {verificationText}
              </Text>
            </View>
          </View>
          <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>
            Aquí aparece primero lo que necesita tu atención hoy. La configuración queda más abajo.
          </Text>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <SectionHeading
            eyebrow="HOY"
            title="Tu negocio ahora"
            subtitle="Estado real y asuntos que conviene resolver antes de cualquier promoción."
          />
          <OwnerPartnerCard
            eyebrow="Estado operativo"
            title={operationalStateLabel(business.operational_state)}
            body={operationalSummary || 'Configura tu horario normal y Palta calculará el estado de cada día.'}
            badge="SIN COSTO"
            tone={operationalTone(business.operational_state)}
            onPress={() => router.push(`/business/manage/${encodeURIComponent(business.id)}/hours`)}
          />

          {correctionCount > 0 ? (
            <OwnerPartnerCard
              eyebrow="Requiere revisión"
              title="Información que podría estar incorrecta"
              body={`${correctionCount} ${correctionCount === 1 ? 'aviso pendiente' : 'avisos pendientes'}. Ningún aviso cambia tu perfil automáticamente.`}
              badge="REVISAR"
              tone="attention"
              onPress={() => router.push(`/business/manage/${encodeURIComponent(business.id)}/corrections`)}
            />
          ) : null}

          {actionItems.slice(0, 2).map((item) => {
            const targetKind = guidanceTargetKind(item.target);
            return (
              <OwnerPartnerCard
                key={item.id}
                eyebrow="Conviene resolver"
                title={item.title}
                body={item.reason}
                badge={item.commercial === 'free' ? 'SIN COSTO' : undefined}
                tone="attention"
                onPress={targetKind
                  ? () => openGuidanceTarget(business.id, targetKind)
                  : undefined}
              />
            );
          })}

          {!hasAttention ? (
            <OwnerPartnerCard
              eyebrow="Hoy"
              title="Todo tranquilo por ahora"
              body="No hay una tarea urgente que Palta necesite ponerte delante en este momento."
              tone="success"
            />
          ) : null}
        </View>

        {reviewCount > 0 ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <SectionHeading
              title="Relación con clientes"
              subtitle="Sólo señales reales que ya existen en Palta, sin métricas inventadas."
            />
            <OwnerPartnerCard
              eyebrow="Atención verificada"
              title={`${reviewCount} ${reviewCount === 1 ? 'opinión' : 'opiniones'} para revisar`}
              body="Estas opiniones están vinculadas a una atención confirmada. Puedes leerlas y responder desde aquí."
              badge="RESPONDER"
              onPress={() => router.push(`/business/manage/${encodeURIComponent(business.id)}/reviews`)}
            />
          </View>
        ) : null}

        {freeSuggestions.length ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <SectionHeading
              title="Ahora conviene esto"
              subtitle="Primero mejoras prácticas que puedes resolver sin contratar otro módulo."
            />
            {freeSuggestions.slice(0, 3).map((item) => {
              const targetKind = guidanceTargetKind(item.target);
              return (
                <OwnerPartnerCard
                  key={item.id}
                  eyebrow="Mejora gratuita"
                  title={item.title}
                  body={item.reason}
                  badge="SIN COSTO"
                  onPress={targetKind
                    ? () => openGuidanceTarget(business.id, targetKind)
                    : undefined}
                />
              );
            })}
          </View>
        ) : null}

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <SectionHeading
            title="Mantén tu presencia útil"
            subtitle="Todo esto pertenece al mismo negocio y su perfil público."
          />
          <OwnerPartnerCard
            title="Perfil público"
            body={[
              serviceSummary || undefined,
              business.contact?.whatsapp ? 'WhatsApp' : undefined,
              business.contact?.phone ? 'Teléfono' : undefined,
            ].filter(Boolean).join(' · ') || 'Completa descripción y forma de contacto.'}
            badge={ownerManaged ? 'SIN COSTO' : undefined}
            onPress={ownerManaged
              ? () => router.push(`/business/manage/${encodeURIComponent(business.id)}/profile`)
              : undefined}
          />
          <OwnerPartnerCard
            title="Servicios"
            body={serviceSummary || 'Confirma qué haces para que Palta pueda encontrarte por necesidades reales.'}
            badge="SIN COSTO"
            onPress={() => router.push(`/business/manage/${encodeURIComponent(business.id)}/services`)}
          />
          <OwnerPartnerCard
            title="Ubicación y zona de atención"
            body={(business.service_area_labels ?? []).slice(0, 3).join(' · ') || 'Revisa cómo se muestra tu ubicación y dónde atiendes.'}
            badge="SIN COSTO"
            onPress={() => router.push(`/business/manage/${encodeURIComponent(business.id)}/location`)}
          />
          <OwnerPartnerCard
            title="Enlaces públicos"
            body={channelSummary || 'Agrega Instagram, Facebook, TikTok, Google, WhatsApp o tu sitio. Son enlaces; no necesitas conectar una API.'}
            badge="SIN COSTO"
            onPress={() => router.push(`/business/manage/${encodeURIComponent(business.id)}/channels`)}
          />

          {business.verification_status === 'verified' ? (
            <>
              <OwnerPartnerCard
                title="Novedades"
                body={latestPost
                  ? `${postCount} publicada${postCount === 1 ? '' : 's'} · Última: ${latestPost.title}`
                  : 'Publica horarios especiales, disponibilidad o noticias concretas en el mismo perfil.'}
                badge="SIN COSTO"
                onPress={() => router.push(`/business/manage/${encodeURIComponent(business.id)}/posts`)}
              />
              <OwnerPartnerCard
                title="Cupón básico"
                body={ownerCoupon
                  ? `${couponExpired ? 'Vencido · ' : ''}${ownerCoupon.title}${ownerCoupon.audience === 'followers' ? ' · Sólo seguidores' : ' · Visible para todos'}`
                  : 'Publica un beneficio simple sin pagar por segmentación ni automatización.'}
                badge="SIN COSTO"
                onPress={() => router.push(`/business/manage/${encodeURIComponent(business.id)}/coupons`)}
              />
            </>
          ) : null}
        </View>

        {paidSuggestions.length ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <SectionHeading
              title="Automatiza sólo si te ahorra trabajo"
              subtitle="Estas opciones aparecen porque Palta detectó una carga real, no para llenar el panel de ventas."
            />
            {paidSuggestions.slice(0, 2).map((item) => (
              <OwnerPartnerCard
                key={item.id}
                eyebrow="Opcional"
                title={item.title}
                body={item.reason}
                badge="PUEDE SER DE PAGO"
                tone="optional"
              />
            ))}
          </View>
        ) : null}

        <Text style={{ color: paltaTheme.color.textMuted, lineHeight: 20 }}>
          La presencia básica, el horario, los servicios, los enlaces, las novedades y el descubrimiento orgánico no dependen de contratar un módulo adicional.
        </Text>

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
