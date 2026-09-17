import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import {
  composePublicBusinessCapabilities,
  type BusinessCapability,
} from '../../../../src/business/businessActionPolicy';
import type { BusinessApiDetail } from '../../../../src/api/paltaApiClient';
import { enqueueMutation } from '../../../../src/mobile/offlineMutationQueue';
import {
  createClientMutationId,
  isRetryableMutationError,
} from '../../../../src/api/retryPolicy';
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
import { useMutationQueueStore } from '../../services/useMutationQueueStore';

function ProfileSection({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  if (!body) return null;
  return (
    <View style={{ gap: 6 }}>
      <SectionHeading title={title} />
      <Text style={{ lineHeight: 22 }}>{body}</Text>
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
    <View style={{ gap: 8 }}>
      <SectionHeading
        title="También puedes encontrar este negocio en"
        subtitle="Palta no te obliga a dejar los canales que ya usas."
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {links.map((link) => (
          <Pressable
            key={`${link.provider}:${link.url}`}
            onPress={() => void Linking.openURL(link.url)}
            style={{
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontWeight: '700' }}>{link.label}</Text>
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

export default function BusinessDetailScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const queueStore = useMutationQueueStore();
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
    return {
      business,
      relationship,
      coupons: coupons.items,
      reviews,
    };
  }, [businessId]);

  const { state, refresh } = useAsyncResource(loadBusiness);

  async function requestQuote() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSubmitting(true);
    setSubmitMessage(null);

    const description = 'Solicitud iniciada desde el detalle del negocio.';
    const mutationId = createClientMutationId(Date.now(), Math.random());

    try {
      const care = await mobileRuntime.client.createCare({
        intentKey: 'local_business_quote',
        subjectEntityId: businessId,
        actionType: 'quote_request',
        payload: { description },
        idempotencyKey: mutationId,
      });
      router.push(`/care/${encodeURIComponent(care.id)}`);
    } catch (error) {
      if (isRetryableMutationError(error)) {
        await queueStore.put(
          enqueueMutation({
            id: mutationId,
            kind: 'business_quote_request',
            payload: {
              businessId,
              description,
            },
            now: new Date().toISOString(),
          }),
        );
        setSubmitMessage(
          'Guardamos tu solicitud. Palta volverá a enviarla cuando recupere conexión.',
        );
      } else {
        setSubmitMessage(
          error instanceof Error
            ? `No se pudo enviar: ${error.message}`
            : 'No se pudo enviar la solicitud.',
        );
      }
    } finally {
      setSubmitting(false);
    }
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
        void requestQuote();
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
  const statusLine = [
    business.category_key,
    business.opening_status,
    business.verification_status === 'verified' ? 'Verificado' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScreenFrame title={business.name} subtitle={statusLine}>
      <View style={{ gap: 18 }}>
        <BusinessPhotoStrip photoUrls={business.photo_urls ?? []} />
        <ProfileSection title="Sobre este negocio" body={business.description} />
        <ProfileSection title="Servicios" body={services} />
        <ProfileSection title="Horario" body={business.hours_summary} />
        <ProfileSection title="Zona de atención" body={serviceAreas} />

        {coupons.length ? (
          <View style={{ gap: 8 }}>
            <SectionHeading
              title="Beneficio"
              subtitle={coupons[0]?.audience === 'followers' ? 'Disponible para seguidores de este negocio' : 'Beneficio publicado por este negocio'}
            />
            {coupons.map((coupon) => (
              <View key={coupon.id} style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}>
                <Text style={{ fontSize: 17, fontWeight: '800' }}>{coupon.title}</Text>
                {coupon.description ? <Text style={{ lineHeight: 20 }}>{coupon.description}</Text> : null}
                {coupon.redemption_instruction ? (
                  <Text style={{ opacity: 0.68, lineHeight: 20 }}>{coupon.redemption_instruction}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {business.posts?.length ? (
          <View style={{ gap: 8 }}>
            <SectionHeading
              title="Novedades"
              subtitle="Información publicada por este negocio. Seguirlo no activa notificaciones promocionales por sí solo."
            />
            {business.posts.slice(0, 5).map((post) => (
              <View key={post.id} style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}>
                <Text style={{ fontSize: 16, fontWeight: '800' }}>{post.title}</Text>
                {post.body ? <Text style={{ lineHeight: 20 }}>{post.body}</Text> : null}
                {post.published_at ? (
                  <Text style={{ opacity: 0.55, fontSize: 12 }}>
                    {new Date(post.published_at).toLocaleString('es-CL')}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {reviews?.items.length ? (
          <View style={{ gap: 8 }}>
            <SectionHeading
              title="Opiniones con atención verificada"
              subtitle={[
                reviews.summary.average_rating !== undefined
                  ? `${reviews.summary.average_rating.toFixed(1).replace('.', ',')} / 5`
                  : undefined,
                `${reviews.summary.count} ${reviews.summary.count === 1 ? 'opinión' : 'opiniones'}`,
              ].filter(Boolean).join(' · ')}
            />
            {reviews.items.slice(0, 5).map((review) => (
              <View key={review.id} style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 }}>
                <Text style={{ fontWeight: '800' }}>
                  {review.author_label} · {'★'.repeat(Math.max(1, Math.min(5, Math.round(review.rating))))}
                </Text>
                <Text style={{ fontSize: 12, opacity: 0.62 }}>
                  Atención verificada · {review.evidence_label}
                </Text>
                {review.body ? <Text style={{ lineHeight: 20 }}>{review.body}</Text> : null}
                <Text style={{ fontSize: 12, opacity: 0.5 }}>
                  {new Date(review.created_at).toLocaleDateString('es-CL')}
                </Text>
                {review.business_reply ? (
                  <View style={{ marginTop: 4, paddingLeft: 10, borderLeftWidth: 2, gap: 3 }}>
                    <Text style={{ fontWeight: '700' }}>Respuesta del negocio</Text>
                    <Text style={{ lineHeight: 20 }}>{review.business_reply.body}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            <Text style={{ fontSize: 12, opacity: 0.58 }}>
              Palta muestra aquí sólo opiniones vinculadas a una atención o servicio confirmado.
            </Text>
          </View>
        ) : null}

        <ExternalChannels links={business.channel_links ?? []} />

        <SectionHeading
          title="Contactar y actuar"
          subtitle="Guardar y seguir son gratuitos. Seguir no activa promociones ni notificaciones por sí solo."
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
          <Text style={{ opacity: 0.62 }}>Actualizando…</Text>
        ) : null}

        {submitMessage ? (
          <Text style={{ opacity: 0.72 }}>{submitMessage}</Text>
        ) : null}

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
