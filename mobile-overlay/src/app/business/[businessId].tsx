import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { BusinessCapability } from '../../../../src/business/businessActionPolicy';
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
          `La acción "${capability}" ya está definida en el contrato, pero su adapter concreto aún no está conectado.`,
        );
        return;
    }
  }

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

  const business = state.data;
  if (!business) {
    return (
      <ScreenFrame title="Negocio">
        <Text>No hay datos disponibles.</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title={business.name}
      subtitle={[business.category_key, business.opening_status]
        .filter(Boolean)
        .join(' · ')}
    >
      <View style={{ gap: 14 }}>
        <Text>
          Verificación: {business.verification_status}. Los datos públicos
          pueden verse; cupones y ofertas controladas requieren propietario
          verificado.
        </Text>

        <SectionHeading
          title="¿Qué quieres hacer?"
          subtitle="Palta muestra sólo acciones que este negocio puede ofrecer."
        />

        <BusinessActionBar
          capabilities={[
            'quote',
            ...(business.contact?.whatsapp ? (['whatsapp'] as const) : []),
            ...(business.contact?.phone ? (['call'] as const) : []),
            'save',
          ]}
          verificationStatus={business.verification_status}
          onAction={handleAction}
        />

        {submitting ? (
          <Text style={{ opacity: 0.62 }}>Enviando solicitud…</Text>
        ) : null}

        {submitMessage ? (
          <Text style={{ opacity: 0.72 }}>{submitMessage}</Text>
        ) : null}

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}

        <Text style={{ opacity: 0.55 }}>Canonical ID: {business.id}</Text>
      </View>
    </ScreenFrame>
  );
}
