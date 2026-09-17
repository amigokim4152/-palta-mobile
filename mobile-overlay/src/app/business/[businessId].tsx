import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import {
  composePublicBusinessCapabilities,
  type BusinessCapability,
} from '../../../../src/business/businessActionPolicy';
import type { BusinessApiDetail } from '../../../../src/api/paltaApiClient';
import {
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { BusinessActionBar } from '../../components/business/BusinessActionBar';
import { BusinessPhotoStrip } from '../../components/business/BusinessPhotoStrip';
import { SectionHeading } from '../../components/common/SectionHeading';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { useNeighborhoodState } from '../../state/NeighborhoodStateProvider';
import { paltaTheme } from '../../theme/paltaTheme';

function ProfileSection({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  if (!body) return null;
  return (
    <View style={{ gap: paltaTheme.spacing.xs }}>
      <SectionHeading title={title} />
      <Text style={{ lineHeight: 22, color: paltaTheme.color.textSecondary }}>{body}</Text>
    </View>
  );
}

function ExternalChannels({
  links,
}: {
  links: readonly { provider: string; label: string; url: string }[];
}) {
  if (!links.length) return null;

  return (
    <View style={{ gap: paltaTheme.spacing.xs }}>
      <SectionHeading
        title="También puedes encontrar este negocio en"
        subtitle="Palta no te obliga a dejar los canales que ya usas."
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
        {links.map((link) => (
          <Pressable
            key={`${link.provider}:${link.url}`}
            onPress={() => void Linking.openURL(link.url)}
            style={{
              minHeight: paltaTheme.touch.minimum,
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: paltaTheme.color.border,
              borderRadius: paltaTheme.radius.pill,
              paddingHorizontal: paltaTheme.spacing.sm,
              backgroundColor: paltaTheme.color.surface,
            }}
          >
            <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>
              {link.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function buildWhatsappUrl(business: BusinessApiDetail): string | undefined {
  const publicLink = business.channel_links?.find(
    (link) => link.provider === 'whatsapp',
  )?.url;
  if (publicLink) return publicLink;

  const raw = business.contact?.whatsapp?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;

  const normalized = digits.startsWith('56')
    ? digits
    : digits.length === 9 && digits.startsWith('9')
      ? `56${digits}`
      : digits;
  return `https://wa.me/${normalized}`;
}

function buildPhoneUrl(business: BusinessApiDetail): string | undefined {
  const raw = business.contact?.phone?.trim();
  if (!raw) return undefined;
  const dialable = raw.replace(/[^+\d]/g, '');
  return dialable ? `tel:${dialable}` : undefined;
}

function ProfileDecisionSummary({
  business,
}: {
  business: BusinessApiDetail;
}) {
  const serviceSummary = business.service_labels?.slice(0, 2).join(' · ');
  const areaSummary = business.service_area_labels?.slice(0, 2).join(' · ');

  return (
    <View
      style={{
        gap: paltaTheme.spacing.xs,
        padding: paltaTheme.spacing.sm,
        borderRadius: paltaTheme.radius.surface,
        backgroundColor: paltaTheme.color.surfaceMuted,
      }}
    >
      {business.opening_status ? (
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            color: paltaTheme.color.brandPrimary,
          }}
        >
          {business.opening_status}
        </Text>
      ) : null}
      {serviceSummary ? (
        <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>
          {serviceSummary}
        </Text>
      ) : null}
      {areaSummary ? (
        <Text style={{ color: paltaTheme.color.textSecondary }}>
          Zona de atención · {areaSummary}
        </Text>
      ) : null}
    </View>
  );
}

export default function BusinessDetailScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { dispatch } = useNeighborhoodState();
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const loadBusiness = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    const [business, relationship, coupons, reviews] = await Promise.all([
      mobileRuntime.client.getBusiness(businessId),
      mobileRuntime.client.getBusinessRelationship(businessId),
      mobileRuntime.client.getBusinessBasicCoupons(businessId),
      mobileRuntime.client.reviews.getBusinessReviews(businessId),
    ]);

    let reviewEligibility;
    try {
      reviewEligibility = await mobileRuntime.client.reviews.getMyReviewEligibility(businessId);
    } catch {
      reviewEligibility = undefined;
    }

    return {
      business,
      relationship,
      coupons: coupons.items,
      reviews,
      reviewEligibility,
    };
  }, [businessId]);

  const { state, refresh } = useAsyncResource(loadBusiness);

  function returnToDiscovery() {
    if (businessId) dispatch({ type: 'select_entity', entityId: businessId });
    router.back();
  }

  async function updateRelationship(capability: 'save' | 'follow') {
    if (!businessId || mobileRuntime.status !== 'ready' || !state.data) return;
    setSubmitting(true);
    setSubmitMessage(null);

    const current = state.data.relationship;
    const update = capability === 'save'
      ? { saved: !current.saved }
      : { following: !current.following };

    try {
      const next = await mobileRuntime.client.updateBusinessRelationship(
        businessId,
        update,
      );
      if (capability === 'save') {
        setSubmitMessage(next.saved ? 'Negocio guardado.' : 'Quitado de tus guardados.');
      } else {
        setSubmitMessage(
          next.following
            ? 'Ahora sigues este negocio. Esto no activa promociones ni notificaciones por sí solo.'
            : 'Dejaste de seguir este negocio.',
        );
      }
      await refresh();
    } catch (error) {
      setSubmitMessage(
        error instanceof Error
          ? `No se pudo actualizar: ${error.message}`
          : 'No se pudo actualizar tu relación con este negocio.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleAction(capability: BusinessCapability) {
    const business = state.data?.business;

    switch (capability) {
      case 'quote':
        if (business) {
          router.push(`/business/${encodeURIComponent(business.id)}/quote`);
        }
        return;
      case 'save':
      case 'follow':
        void updateRelationship(capability);
        return;
      case 'coupon':
        setSubmitMessage(
          state.data?.coupons.length
            ? 'El beneficio activo está mostrado en este perfil.'
            : 'No hay un cupón disponible para ti en este momento.',
        );
        return;
      case 'whatsapp': {
        const url = business ? buildWhatsappUrl(business) : undefined;
        if (!url) {
          setSubmitMessage('Este negocio todavía no publicó un WhatsApp válido.');
          return;
        }
        void Linking.openURL(url).catch(() => {
          setSubmitMessage('No pudimos abrir WhatsApp en este dispositivo.');
        });
        return;
      }
      case 'call': {
        const url = business ? buildPhoneUrl(business) : undefined;
        if (!url) {
          setSubmitMessage('Este negocio todavía no publicó un teléfono válido.');
          return;
        }
        void Linking.openURL(url).catch(() => {
          setSubmitMessage('No pudimos abrir el teléfono en este dispositivo.');
        });
        return;
      }
      case 'inquiry':
        setSubmitMessage(
          'La consulta por Palta usará el Messaging Core compartido. El acceso se habilitará sólo cuando ese transporte canónico esté conectado; no crearemos un chat paralelo.',
        );
        return;
      case 'reservation':
      case 'queue':
      case 'pricing':
        setSubmitMessage(
          `La acción "${capability}" requiere su módulo operativo compartido antes de habilitarse.`,
        );
        return;
    }
  }

  const business = state.data?.business;
  const relationship = state.data?.relationship;
  const coupons = state.data?.coupons ?? [];
  const reviews = state.data?.reviews;
  const reviewEligibility = state.data?.reviewEligibility;
  const publicCapabilities = useMemo(
    () =>
      business
        ? composePublicBusinessCapabilities({
            enabledCapabilities: business.enabled_capabilities ?? [],
            hasWhatsapp: Boolean(business.contact?.whatsapp),
            hasPhone: Boolean(business.contact?.phone),
          })
        : [],
    [
      business?.enabled_capabilities,
      business?.contact?.whatsapp,
      business?.contact?.phone,
    ],
  );

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Negocio">
        <LoadingState label="Cargando negocio…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Negocio">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  if (!business || !relationship) {
    return (
      <ScreenFrame title="Negocio">
        <Text>No hay datos disponibles.</Text>
      </ScreenFrame>
    );
  }

  const services = business.service_labels?.join(' · ');
  const serviceAreas = business.service_area_labels?.join(' · ');
  const identityLine = [
    business.category_key,
    business.verification_status === 'verified' ? 'Verificado' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScreenFrame
      title={business.name}
      subtitle={identityLine}
      action={
        <Pressable
          onPress={returnToDiscovery}
          style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center' }}
        >
          <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
            Volver a negocios
          </Text>
        </Pressable>
      }
    >
      <View style={{ gap: paltaTheme.spacing.lg }}>
        <BusinessPhotoStrip photoUrls={business.photo_urls ?? []} />

        <ProfileDecisionSummary business={business} />

        <View style={{ gap: paltaTheme.spacing.xs }}>
          <SectionHeading
            title="¿Qué quieres hacer?"
            subtitle="Acciones disponibles ahora para este negocio."
          />
          <BusinessActionBar
            capabilities={publicCapabilities}
            verificationStatus={business.verification_status}
            relationship={{
              saved: relationship.saved,
              following: relationship.following,
            }}
            onAction={handleAction}
          />
          {submitting ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>Actualizando…</Text>
          ) : null}
          {submitMessage ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>{submitMessage}</Text>
          ) : null}
        </View>

        <ProfileSection title="Servicios" body={services} />
        <ProfileSection title="Sobre este negocio" body={business.description} />

        {coupons.length ? (
          <View style={{ gap: paltaTheme.spacing.xs }}>
            <SectionHeading
              title="Beneficio"
              subtitle={coupons[0]?.audience === 'followers'
                ? 'Disponible para seguidores de este negocio'
                : 'Beneficio publicado por este negocio'}
            />
            {coupons.map((coupon) => (
              <View
                key={coupon.id}
                style={{
                  borderRadius: paltaTheme.radius.surface,
                  padding: paltaTheme.spacing.sm,
                  gap: paltaTheme.spacing.xxs,
                  backgroundColor: paltaTheme.color.brandSoft,
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  {coupon.title}
                </Text>
                {coupon.description ? (
                  <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                    {coupon.description}
                  </Text>
                ) : null}
                {coupon.redemption_instruction ? (
                  <Text style={{ lineHeight: 20, color: paltaTheme.color.textMuted }}>
                    {coupon.redemption_instruction}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {reviews ? (
          <View style={{ gap: paltaTheme.spacing.xs }}>
            <SectionHeading
              title="Opiniones con atención verificada"
              subtitle={[
                reviews.summary.average_rating !== undefined
                  ? `${reviews.summary.average_rating.toFixed(1).replace('.', ',')} / 5`
                  : undefined,
                `${reviews.summary.count} ${reviews.summary.count === 1 ? 'opinión' : 'opiniones'}`,
              ].filter(Boolean).join(' · ')}
            />
            {reviews.items.length ? (
              reviews.items.slice(0, 5).map((review) => (
                <View
                  key={review.id}
                  style={{
                    borderWidth: 1,
                    borderColor: paltaTheme.color.border,
                    borderRadius: paltaTheme.radius.surface,
                    padding: paltaTheme.spacing.sm,
                    gap: paltaTheme.spacing.xxs,
                  }}
                >
                  <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                    {review.author_label} · {'★'.repeat(Math.max(1, Math.min(5, Math.round(review.rating))))}
                  </Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                    Atención verificada · {review.evidence_label}
                  </Text>
                  {review.body ? (
                    <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                      {review.body}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                    {new Date(review.created_at).toLocaleDateString('es-CL')}
                  </Text>
                  {review.business_reply ? (
                    <View
                      style={{
                        marginTop: paltaTheme.spacing.xxs,
                        paddingLeft: paltaTheme.spacing.xs,
                        borderLeftWidth: 2,
                        borderLeftColor: paltaTheme.color.border,
                        gap: paltaTheme.spacing.xxs,
                      }}
                    >
                      <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>
                        Respuesta del negocio
                      </Text>
                      <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                        {review.business_reply.body}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={{ color: paltaTheme.color.textSecondary }}>
                Todavía no hay opiniones vinculadas a una atención confirmada.
              </Text>
            )}
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
              Palta muestra aquí sólo opiniones vinculadas a una atención o servicio confirmado.
            </Text>
            {reviewEligibility?.eligible ? (
              <Pressable
                onPress={() => router.push(`/business/${encodeURIComponent(business.id)}/review`)}
                style={{
                  minHeight: paltaTheme.touch.minimum,
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: paltaTheme.color.border,
                  borderRadius: paltaTheme.radius.control,
                  paddingHorizontal: paltaTheme.spacing.sm,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '800' }}>
                  Escribir opinión verificada
                </Text>
              </Pressable>
            ) : reviewEligibility?.reason === 'already_reviewed' ? (
              <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                Ya dejaste una opinión por tu atención verificada más reciente.
              </Text>
            ) : null}
          </View>
        ) : null}

        {business.posts?.length ? (
          <View style={{ gap: paltaTheme.spacing.xs }}>
            <SectionHeading
              title="Novedades"
              subtitle="Información útil publicada por este negocio."
            />
            {business.posts.slice(0, 3).map((post) => (
              <View
                key={post.id}
                style={{
                  borderWidth: 1,
                  borderColor: paltaTheme.color.border,
                  borderRadius: paltaTheme.radius.surface,
                  padding: paltaTheme.spacing.sm,
                  gap: paltaTheme.spacing.xxs,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  {post.title}
                </Text>
                {post.body ? (
                  <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                    {post.body}
                  </Text>
                ) : null}
                {post.published_at ? (
                  <Text style={{ color: paltaTheme.color.textMuted, fontSize: 12 }}>
                    {new Date(post.published_at).toLocaleString('es-CL')}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <ProfileSection title="Horario" body={business.hours_summary} />
        <ProfileSection title="Zona de atención" body={serviceAreas} />

        <ExternalChannels links={business.channel_links ?? []} />

        <Pressable
          onPress={() => router.push(`/business/${encodeURIComponent(business.id)}/report`)}
          style={{
            borderWidth: 1,
            borderColor: paltaTheme.color.border,
            borderRadius: paltaTheme.radius.surface,
            padding: paltaTheme.spacing.sm,
            gap: paltaTheme.spacing.xxs,
          }}
        >
          <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
            ¿Ves información incorrecta?
          </Text>
          <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>
            Avísanos para revisarla. Un reporte no modifica automáticamente la ficha.
          </Text>
        </Pressable>

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
