import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import type { BusinessCapability } from '../../../../../src/business/businessActionPolicy';
import { enqueueMutation } from '../../../../../src/mobile/offlineMutationQueue';
import {
  createClientMutationId,
  isRetryableMutationError,
} from '../../../../../src/api/retryPolicy';
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

const capabilitySet = new Set<BusinessCapability>([
  'call',
  'whatsapp',
  'save',
  'quote',
  'reservation',
  'queue',
  'inquiry',
  'coupon',
  'pricing',
]);

function businessCapabilities(input: {
  enabled_capabilities?: string[];
  contact?: { phone?: string; whatsapp?: string };
}): BusinessCapability[] {
  const result: BusinessCapability[] = [];
  for (const value of input.enabled_capabilities ?? []) {
    if (capabilitySet.has(value as BusinessCapability)) {
      result.push(value as BusinessCapability);
    }
  }
  if (input.contact?.whatsapp && !result.includes('whatsapp')) result.push('whatsapp');
  if (input.contact?.phone && !result.includes('call')) result.push('call');
  if (!result.includes('save')) result.push('save');
  return result;
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

  const ownerStatus = business.owner_verification_status ?? business.verification_status;
  const capabilities = businessCapabilities(business);
  const sample = business.record_class === 'sample';
  const hoursText =
    business.hours_summary ??
    business.hours_raw?.join(' · ') ??
    business.hours?.map((item) => item.raw ?? [item.day, item.open, item.close].filter(Boolean).join(' ')).filter(Boolean).join(' · ');

  return (
    <ScreenFrame
      title={business.name}
      subtitle={[business.category_key, business.opening_status]
        .filter(Boolean)
        .join(' · ')}
    >
      <View style={{ gap: 16 }}>
        {sample ? (
          <View style={{ padding: 12, borderWidth: 1, borderRadius: 10 }}>
            <Text style={{ fontWeight: '700' }}>DATOS DE PRUEBA</Text>
            <Text style={{ opacity: 0.72 }}>
              Este perfil existe sólo para desarrollo y nunca debe publicarse como un negocio real.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 5 }}>
          {business.address ? <Text>{business.address}</Text> : null}
          {business.commune || business.region ? (
            <Text style={{ opacity: 0.66 }}>
              {[business.commune, business.region].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 5 }}>
          <Text>
            Información pública: {business.fact_verification_status ?? 'sin confirmar'}
          </Text>
          <Text>
            Propietario en Palta: {ownerStatus}
          </Text>
          <Text style={{ opacity: 0.66 }}>
            Confirmar datos públicos no significa que el propietario esté verificado. Cupones,
            precios y otras acciones controladas requieren autorización del negocio.
          </Text>
        </View>

        {hoursText || business.hours_note ? (
          <View style={{ gap: 5 }}>
            <SectionHeading title="Horario" />
            {hoursText ? <Text>{hoursText}</Text> : null}
            {business.hours_note ? (
              <Text style={{ opacity: 0.66 }}>{business.hours_note}</Text>
            ) : null}
          </View>
        ) : null}

        {business.service_labels?.length ? (
          <View style={{ gap: 5 }}>
            <SectionHeading title="Servicios" />
            <Text>{business.service_labels.join(' · ')}</Text>
          </View>
        ) : null}

        {business.parking ? (
          <Text>Estacionamiento: {business.parking}</Text>
        ) : null}

        <SectionHeading
          title="¿Qué quieres hacer?"
          subtitle="Palta muestra sólo acciones disponibles para este negocio."
        />

        <BusinessActionBar
          capabilities={capabilities}
          verificationStatus={business.verification_status}
          onAction={handleAction}
        />

        {submitting ? (
          <Text style={{ opacity: 0.62 }}>Enviando solicitud…</Text>
        ) : null}

        {submitMessage ? (
          <Text style={{ opacity: 0.72 }}>{submitMessage}</Text>
        ) : null}

        {business.evidence?.checked_at ? (
          <Text style={{ opacity: 0.52 }}>
            Datos revisados: {business.evidence.checked_at}
          </Text>
        ) : null}

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}

        <Text style={{ opacity: 0.45 }}>Canonical ID: {business.id}</Text>
      </View>
    </ScreenFrame>
  );
}
