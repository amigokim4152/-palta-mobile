import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { careStateLabel } from '../../../../src/care/careTimeline';
import {
  DEFAULT_TIMEZONE,
  careT,
} from '../../../../src/localization/index';
import {
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { CareTimeline } from '../../components/care/CareTimeline';
import { PaltaButton } from '../../components/common/PaltaButton';
import { SectionHeading } from '../../components/common/SectionHeading';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useLocalization } from '../../providers/LocalizationProvider';
import { mobileRuntime } from '../../services/paltaClient';

export default function CareTrackScreen() {
  const { careTrackId } = useLocalSearchParams<{ careTrackId: string }>();
  const { locale } = useLocalization();

  const loadCare = useCallback(async () => {
    if (!careTrackId) throw new Error('Care ID missing');
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getCare(careTrackId);
  }, [careTrackId]);

  const { state, refresh } = useAsyncResource(loadCare);

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title={careT('care.title', locale)}>
        <LoadingState label={careT('care.loading', locale)} />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title={careT('care.title', locale)}>
        <ErrorState onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const care = state.data;
  if (!care) {
    return (
      <ScreenFrame title={careT('care.title', locale)}>
        <Text>{careT('care.noData', locale)}</Text>
      </ScreenFrame>
    );
  }

  const currentStateLabel = careStateLabel(care.state, locale);
  const estimatedAt = care.expected_at
    ? new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: DEFAULT_TIMEZONE,
      }).format(new Date(care.expected_at))
    : null;

  return (
    <ScreenFrame title={careT('care.title', locale)} subtitle={care.intent_key}>
      <View style={{ gap: 12 }}>
        <SectionHeading
          eyebrow={careT('care.eyebrow', locale)}
          title={careT('care.state', locale, { state: currentStateLabel })}
          subtitle={careT('care.subtitle', locale)}
        />
        <CareTimeline state={care.state} />
        {care.waiting_for ? (
          <Text>
            {careT('care.waitingFor', locale, { value: care.waiting_for })}
          </Text>
        ) : null}
        {estimatedAt ? (
          <Text>
            {careT('care.estimatedAt', locale, { value: estimatedAt })}
          </Text>
        ) : null}
        <Text style={{ opacity: 0.55 }}>
          {careT('care.id', locale, { id: care.id })}
        </Text>

        <PaltaButton
          label={careT('care.refresh', locale)}
          variant="secondary"
          onPress={() => void refresh()}
        />

        <PaltaButton
          label={careT('care.backHome', locale)}
          onPress={() => router.replace('/(tabs)/home')}
        />

        {state.status === 'error' ? (
          <ErrorState onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
