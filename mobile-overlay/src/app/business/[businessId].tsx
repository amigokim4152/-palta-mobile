import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import {
  composePublicBusinessCapabilities,
  type BusinessCapability,
} from '../../../../src/business/businessActionPolicy';
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
    return mobileRuntime.client.getBusiness(businessId);
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

  function handleAction(capability: BusinessCapability) {
    switch (capability) {
      case 'quote':
        void requestQuote();
        return;
      case 'whatsapp':
      case 'call':
      case 'save':
      case 'reservation':
      case 'queue':
      case 'inquiry':
      case 'coupon':
      case 'pricing':
        setSubmitMessage(
          `La acción "${capability}" está disponible en el perfil, pero su adapter concreto aún no está conectado en esta compilación.`,
        );
        return;
    }
  }

  const business = state.data;
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

  if (!business) {
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
        <ProfileSection title="Sobre este negocio" body={business.description} />
        <ProfileSection title="Servicios" body={services} />
        <ProfileSection title="Horario" body={business.hours_summary} />
        <ProfileSection title="Zona de atención" body={serviceAreas} />

        <ExternalChannels links={business.channel_links ?? []} />

        <SectionHeading
          title="Contactar y actuar"
          subtitle="Las funciones adicionales aparecen sólo cuando este negocio las tiene habilitadas."
        />

        <BusinessActionBar
          capabilities={publicCapabilities}
          verificationStatus={business.verification_status}
          onAction={handleAction}
        />

        {business.posts?.length ? (
          <View style={{ gap: 8 }}>
            <SectionHeading title="Novedades" />
            {business.posts.slice(0, 3).map((post) => (
              <Text key={post.id} style={{ lineHeight: 21 }}>
                {post.title}
              </Text>
            ))}
          </View>
        ) : null}

        {submitting ? (
          <Text style={{ opacity: 0.62 }}>Enviando solicitud…</Text>
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
