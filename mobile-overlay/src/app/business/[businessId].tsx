import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import type { BusinessCapability } from '../../../../src/business/businessActionPolicy';
import { enqueueMutation } from '../../../../src/mobile/offlineMutationQueue';
import {
  createClientMutationId,
  isRetryableMutationError,
} from '../../../../src/api/retryPolicy';
import {
  businessCapabilityLabel,
  businessVerificationLabel,
} from '../../../../src/localization/index';
import {
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { BusinessActionBar } from '../../components/business/BusinessActionBar';
import { SectionHeading } from '../../components/common/SectionHeading';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useLocalization } from '../../providers/LocalizationProvider';
import { mobileRuntime } from '../../services/paltaClient';
import { useMutationQueueStore } from '../../services/useMutationQueueStore';

export default function BusinessDetailScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const queueStore = useMutationQueueStore();
  const { locale, t } = useLocalization();
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const loadBusiness = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getBusiness(businessId, locale);
  }, [businessId, locale]);

  const { state, refresh } = useAsyncResource(loadBusiness);

  async function requestQuote() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSubmitting(true);
    setSubmitMessage(null);

    const sourceContext = 'business_detail' as const;
    const mutationId = createClientMutationId(Date.now(), Math.random());

    try {
      const care = await mobileRuntime.client.createCare({
        intentKey: 'local_business_quote',
        subjectEntityId: businessId,
        actionType: 'quote_request',
        payload: { source_context: sourceContext },
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
              sourceContext,
            },
            now: new Date().toISOString(),
          }),
        );
        setSubmitMessage(t('business.quoteQueued'));
      } else {
        setSubmitMessage(t('business.sendFailed'));
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
          t('business.adapterPending', {
            capability: businessCapabilityLabel(capability, locale),
          }),
        );
        return;
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title={t('business.genericTitle')}>
        <LoadingState label={t('business.loading')} />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title={t('business.genericTitle')}>
        <ErrorState onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const business = state.data;
  if (!business) {
    return (
      <ScreenFrame title={t('business.genericTitle')}>
        <Text>{t('business.noData')}</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title={business.name}
      subtitle={[
        business.category_label ?? business.category_key,
        business.opening_status_label ?? business.opening_status,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <View style={{ gap: 14 }}>
        <Text>
          {t('business.verificationNote', {
            status: businessVerificationLabel(
              business.verification_status,
              locale,
            ),
          })}
        </Text>

        <SectionHeading
          title={t('business.actionTitle')}
          subtitle={t('business.actionSubtitle')}
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
          <Text style={{ opacity: 0.62 }}>{t('business.sendingQuote')}</Text>
        ) : null}

        {submitMessage ? (
          <Text style={{ opacity: 0.72 }}>{submitMessage}</Text>
        ) : null}

        {state.status === 'error' ? (
          <ErrorState onRetry={() => void refresh()} />
        ) : null}

        <Text style={{ opacity: 0.55 }}>
          {t('business.canonicalId', { id: business.id })}
        </Text>
      </View>
    </ScreenFrame>
  );
}
