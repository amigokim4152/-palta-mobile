import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  composePublicBusinessCapabilities,
  type BusinessCapability,
} from '../../../../src/business/businessActionPolicy';
import type { BusinessApiDetail } from '../../../../src/api/paltaApiClient';
import { ErrorState, LoadingState } from '../../components/AsyncStateBlock';
import { BusinessActionBar } from '../../components/business/BusinessActionBar';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { useNeighborhoodState } from '../../state/NeighborhoodStateProvider';
import { paltaTheme } from '../../theme/paltaTheme';

function buildWhatsappUrl(business: BusinessApiDetail): string | undefined {
  const publicLink = business.channel_links?.find((link) => link.provider === 'whatsapp')?.url;
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

function SurfaceCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        padding: paltaTheme.spacing.md,
        borderRadius: paltaTheme.radius.surface,
        backgroundColor: paltaTheme.color.surface,
      }}
    >
      {children}
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '800',
          letterSpacing: -0.25,
          color: paltaTheme.color.textPrimary,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 13, lineHeight: 18, color: paltaTheme.color.textMuted }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function ServicePills({ labels }: { labels: readonly string[] }) {
  if (!labels.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
      {labels.slice(0, 8).map((label) => (
        <View
          key={label}
          style={{
            paddingHorizontal: paltaTheme.spacing.sm,
            paddingVertical: 7,
            borderRadius: paltaTheme.radius.pill,
            backgroundColor: paltaTheme.color.surfaceMuted,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.textSecondary }}>
            {label}
          </Text>
        </View>
      ))}
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
    <SurfaceCard>
      <View style={{ gap: paltaTheme.spacing.sm }}>
        <SectionTitle title="En otros canales" subtitle="Abre el canal que ya usa este negocio." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
            {links.map((link) => (
              <Pressable
                key={`${link.provider}:${link.url}`}
                onPress={() => void Linking.openURL(link.url)}
                style={({ pressed }) => ({
                  minHeight: paltaTheme.touch.minimum,
                  justifyContent: 'center',
                  paddingHorizontal: paltaTheme.spacing.sm,
                  borderRadius: paltaTheme.radius.pill,
                  backgroundColor: pressed
                    ? paltaTheme.color.surfaceMuted
                    : paltaTheme.color.canvas,
                })}
              >
                <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  {link.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </SurfaceCard>
  );
}

function ProfileHero({
  business,
  onBack,
}: {
  business: BusinessApiDetail;
  onBack: () => void;
}) {
  const { width } = useWindowDimensions();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const photos = (business.photo_urls ?? []).filter(Boolean).slice(0, 6);
  const serviceLine = business.service_labels?.slice(0, 2).join(' · ');
  const areaLine = business.service_area_labels?.slice(0, 2).join(' · ');

  return (
    <View>
      <View
        style={{
          height: 245,
          backgroundColor: paltaTheme.color.brandSoft,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {photos.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
              setActivePhotoIndex(Math.max(0, Math.min(photos.length - 1, next)));
            }}
          >
            {photos.map((photo, index) => (
              <Image
                key={`${photo}:${index}`}
                source={{ uri: photo }}
                accessibilityLabel={`Foto ${index + 1} de ${business.name}`}
                resizeMode="cover"
                style={{ width, height: 245 }}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: 72,
                fontWeight: '800',
                color: paltaTheme.color.brandPrimary,
                opacity: 0.8,
              }}
            >
              {business.name.trim().charAt(0).toUpperCase() || 'P'}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a negocios"
          onPress={onBack}
          style={({ pressed }) => ({
            position: 'absolute',
            top: paltaTheme.spacing.sm,
            left: paltaTheme.spacing.md,
            minWidth: 48,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: paltaTheme.spacing.sm,
            borderRadius: paltaTheme.radius.pill,
            backgroundColor: pressed
              ? paltaTheme.color.surfaceMuted
              : paltaTheme.color.surface,
          })}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
            Volver
          </Text>
        </Pressable>

        {photos.length > 1 ? (
          <View
            style={{
              position: 'absolute',
              right: paltaTheme.spacing.md,
              bottom: paltaTheme.spacing.sm,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: paltaTheme.radius.pill,
              backgroundColor: 'rgba(17,17,17,0.68)',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
              {activePhotoIndex + 1}/{photos.length}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{
          paddingHorizontal: paltaTheme.spacing.md,
          paddingTop: paltaTheme.spacing.md,
          paddingBottom: paltaTheme.spacing.sm,
          gap: paltaTheme.spacing.xs,
          backgroundColor: paltaTheme.color.canvas,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: paltaTheme.spacing.sm }}>
          <Text
            style={{
              flex: 1,
              fontSize: 27,
              lineHeight: 32,
              fontWeight: '800',
              letterSpacing: -0.6,
              color: paltaTheme.color.textPrimary,
            }}
          >
            {business.name}
          </Text>
          {business.verification_status === 'verified' ? (
            <View
              style={{
                marginTop: 2,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: paltaTheme.radius.pill,
                backgroundColor: paltaTheme.color.brandSoft,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
                Verificado
              </Text>
            </View>
          ) : null}
        </View>

        {serviceLine ? (
          <Text style={{ fontSize: 15, fontWeight: '700', color: paltaTheme.color.textSecondary }}>
            {serviceLine}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {business.opening_status ? (
            <Text style={{ fontSize: 14, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
              {business.opening_status}
            </Text>
          ) : null}
          {areaLine ? (
            <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>
              · {areaLine}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function BusinessProfileExperience() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { dispatch } = useNeighborhoodState();
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const loadBusiness = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
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
      const next = await mobileRuntime.client.updateBusinessRelationship(businessId, update);
      setSubmitMessage(
        capability === 'save'
          ? next.saved
            ? 'Negocio guardado.'
            : 'Quitado de tus guardados.'
          : next.following
            ? 'Ahora sigues este negocio.'
            : 'Dejaste de seguir este negocio.',
      );
      await refresh();
    } catch (error) {
      setSubmitMessage(
        error instanceof Error ? `No se pudo actualizar: ${error.message}` : 'No se pudo actualizar.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleAction(capability: BusinessCapability) {
    const business = state.data?.business;
    switch (capability) {
      case 'quote':
        if (business) router.push(`/business/${encodeURIComponent(business.id)}/quote`);
        return;
      case 'save':
      case 'follow':
        void updateRelationship(capability);
        return;
      case 'coupon':
        setSubmitMessage(
          state.data?.coupons.length
            ? 'El beneficio activo está mostrado más abajo.'
            : 'No hay un beneficio disponible ahora.',
        );
        return;
      case 'whatsapp': {
        const url = business ? buildWhatsappUrl(business) : undefined;
        if (!url) {
          setSubmitMessage('Este negocio todavía no publicó un WhatsApp válido.');
          return;
        }
        void Linking.openURL(url).catch(() => setSubmitMessage('No pudimos abrir WhatsApp.'));
        return;
      }
      case 'call': {
        const url = business ? buildPhoneUrl(business) : undefined;
        if (!url) {
          setSubmitMessage('Este negocio todavía no publicó un teléfono válido.');
          return;
        }
        void Linking.openURL(url).catch(() => setSubmitMessage('No pudimos abrir el teléfono.'));
        return;
      }
      case 'inquiry':
        setSubmitMessage('La consulta por Palta se habilitará al conectar el Messaging Core compartido.');
        return;
      case 'reservation':
      case 'queue':
      case 'pricing':
        setSubmitMessage('Esta acción se habilitará cuando su módulo operativo compartido esté conectado.');
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
    [business?.enabled_capabilities, business?.contact?.whatsapp, business?.contact?.phone],
  );

  if (state.status === 'loading' && !state.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, padding: paltaTheme.spacing.md }}>
          <LoadingState label="Cargando negocio…" />
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, padding: paltaTheme.spacing.md }}>
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!business || !relationship) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ padding: paltaTheme.spacing.md }}>
          <Text style={{ color: paltaTheme.color.textSecondary }}>No hay datos disponibles.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <ProfileHero business={business} onBack={returnToDiscovery} />

        <View style={{ paddingHorizontal: paltaTheme.spacing.md, gap: paltaTheme.spacing.md }}>
          <SurfaceCard>
            <View style={{ gap: paltaTheme.spacing.sm }}>
              <BusinessActionBar
                capabilities={publicCapabilities}
                verificationStatus={business.verification_status}
                relationship={{ saved: relationship.saved, following: relationship.following }}
                onAction={handleAction}
              />
              {submitting ? (
                <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>Actualizando…</Text>
              ) : null}
              {submitMessage ? (
                <Text style={{ fontSize: 13, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                  {submitMessage}
                </Text>
              ) : null}
            </View>
          </SurfaceCard>

          {business.service_labels?.length ? (
            <SurfaceCard>
              <View style={{ gap: paltaTheme.spacing.sm }}>
                <SectionTitle title="Qué hace este negocio" />
                <ServicePills labels={business.service_labels} />
                {business.description ? (
                  <Text style={{ lineHeight: 21, color: paltaTheme.color.textSecondary }}>
                    {business.description}
                  </Text>
                ) : null}
              </View>
            </SurfaceCard>
          ) : business.description ? (
            <SurfaceCard>
              <View style={{ gap: paltaTheme.spacing.sm }}>
                <SectionTitle title="Sobre este negocio" />
                <Text style={{ lineHeight: 21, color: paltaTheme.color.textSecondary }}>
                  {business.description}
                </Text>
              </View>
            </SurfaceCard>
          ) : null}

          {coupons.length ? (
            <View
              style={{
                padding: paltaTheme.spacing.md,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.avocadoCream,
                gap: paltaTheme.spacing.sm,
              }}
            >
              <SectionTitle title="Beneficio disponible" />
              {coupons.map((coupon) => (
                <View key={coupon.id} style={{ gap: 4 }}>
                  <Text style={{ fontSize: 19, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                    {coupon.title}
                  </Text>
                  {coupon.description ? (
                    <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                      {coupon.description}
                    </Text>
                  ) : null}
                  {coupon.redemption_instruction ? (
                    <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>
                      {coupon.redemption_instruction}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {reviews ? (
            <SurfaceCard>
              <View style={{ gap: paltaTheme.spacing.sm }}>
                <SectionTitle
                  title="Opiniones verificadas"
                  subtitle={[
                    reviews.summary.average_rating !== undefined
                      ? `${reviews.summary.average_rating.toFixed(1).replace('.', ',')} / 5`
                      : undefined,
                    `${reviews.summary.count} ${reviews.summary.count === 1 ? 'opinión' : 'opiniones'}`,
                  ].filter(Boolean).join(' · ')}
                />

                {reviews.items.length ? (
                  reviews.items.slice(0, 3).map((review, index) => (
                    <View
                      key={review.id}
                      style={{
                        paddingTop: index === 0 ? 0 : paltaTheme.spacing.sm,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: paltaTheme.color.divider,
                        gap: 5,
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                        {'★'.repeat(Math.max(1, Math.min(5, Math.round(review.rating))))}
                        {'  '}{review.author_label}
                      </Text>
                      <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                        Atención verificada · {review.evidence_label}
                      </Text>
                      {review.body ? (
                        <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                          {review.body}
                        </Text>
                      ) : null}
                      {review.business_reply ? (
                        <View
                          style={{
                            marginTop: 3,
                            padding: paltaTheme.spacing.xs,
                            borderRadius: paltaTheme.radius.control,
                            backgroundColor: paltaTheme.color.surfaceMuted,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                            Respuesta del negocio
                          </Text>
                          <Text style={{ marginTop: 3, lineHeight: 19, color: paltaTheme.color.textSecondary }}>
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

                {reviewEligibility?.eligible ? (
                  <Pressable
                    onPress={() => router.push(`/business/${encodeURIComponent(business.id)}/review`)}
                    style={({ pressed }) => ({
                      minHeight: paltaTheme.touch.minimum,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: paltaTheme.radius.control,
                      backgroundColor: pressed
                        ? paltaTheme.color.surfaceMuted
                        : paltaTheme.color.canvas,
                    })}
                  >
                    <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                      Escribir opinión verificada
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </SurfaceCard>
          ) : null}

          {business.posts?.length ? (
            <SurfaceCard>
              <View style={{ gap: paltaTheme.spacing.sm }}>
                <SectionTitle title="Novedades" subtitle="Lo último publicado por este negocio." />
                {business.posts.slice(0, 3).map((post, index) => (
                  <View
                    key={post.id}
                    style={{
                      paddingTop: index === 0 ? 0 : paltaTheme.spacing.sm,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: paltaTheme.color.divider,
                      gap: 4,
                    }}
                  >
                    <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                      {post.title}
                    </Text>
                    {post.body ? (
                      <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                        {post.body}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </SurfaceCard>
          ) : null}

          {(business.hours_summary || business.service_area_labels?.length) ? (
            <SurfaceCard>
              <View style={{ gap: paltaTheme.spacing.md }}>
                <SectionTitle title="Información útil" />
                {business.hours_summary ? (
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>
                      HORARIO
                    </Text>
                    <Text style={{ marginTop: 4, lineHeight: 20, color: paltaTheme.color.textPrimary }}>
                      {business.hours_summary}
                    </Text>
                  </View>
                ) : null}
                {business.service_area_labels?.length ? (
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>
                      ZONA DE ATENCIÓN
                    </Text>
                    <Text style={{ marginTop: 4, lineHeight: 20, color: paltaTheme.color.textPrimary }}>
                      {business.service_area_labels.join(' · ')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </SurfaceCard>
          ) : null}

          <ExternalChannels links={business.channel_links ?? []} />

          <Pressable
            onPress={() => router.push(`/business/${encodeURIComponent(business.id)}/report`)}
            style={({ pressed }) => ({
              padding: paltaTheme.spacing.md,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: pressed
                ? paltaTheme.color.surfaceMuted
                : paltaTheme.color.surface,
            })}
          >
            <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
              ¿Ves información incorrecta?
            </Text>
            <Text style={{ marginTop: 4, lineHeight: 20, color: paltaTheme.color.textMuted }}>
              Avísanos y la revisamos. Tu reporte no cambia la ficha automáticamente.
            </Text>
          </Pressable>

          {state.status === 'error' ? (
            <ErrorState message={state.message} onRetry={() => void refresh()} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
