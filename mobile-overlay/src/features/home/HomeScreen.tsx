import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import type { UiKey } from '../../../../src/localization/index';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { HomeCandidateCard } from '../../components/HomeCandidateCard';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { SectionHeading } from '../../components/common/SectionHeading';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useLocalization } from '../../providers/LocalizationProvider';
import { mobileRuntime } from '../../services/paltaClient';
import { selectHomeDisplayItems } from '../../../../src/home/selectHomeDisplayItems';

function eyebrowKey(kind: string): UiKey {
  if (kind === 'action' || kind === 'alert') return 'home.eyebrowNow';
  if (kind === 'status') return 'home.eyebrowInProgress';
  if (kind === 'content') return 'home.eyebrowForToday';
  return 'home.eyebrowToday';
}

export function HomeScreen() {
  const adaptive = useAdaptiveExperience();
  const { t } = useLocalization();
  const loadHome = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getHome();
  }, []);

  const { state, refresh } = useAsyncResource(loadHome, {
    isEmpty: (data) => data.items.length === 0,
  });

  const selection = useMemo(
    () => selectHomeDisplayItems(state.data?.items ?? []),
    [state.data?.items],
  );

  return (
    <ScreenFrame title="Palta" subtitle={t('home.subtitle')}>
      {state.status === 'loading' && !state.data ? (
        <LoadingState label={t('home.loading')} />
      ) : null}

      {state.status === 'error' && !state.data ? (
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
        />
      ) : null}

      {selection.items.length > 0 ? (
        <View style={{ gap: 2 }}>
          <SectionHeading
            title={t('home.sectionTitle')}
            subtitle={t('home.sectionSubtitle')}
          />

          {selection.items
            .slice(
              0,
              adaptive.textScaleClass === 'accessibility'
                ? Math.min(selection.items.length, 4)
                : selection.items.length,
            )
            .map((item) => (
              <HomeCandidateCard
                key={item.id}
                eyebrow={t(eyebrowKey(item.kind))}
                title={item.title}
                body={item.body}
                actionLabel={
                  item.care_track_id ? t('home.careTracking') : undefined
                }
                onPress={
                  item.care_track_id
                    ? () =>
                        router.push(
                          `/care/${encodeURIComponent(item.care_track_id!)}`,
                        )
                    : undefined
                }
              />
            ))}

          {adaptive.textScaleClass === 'accessibility' &&
          selection.items.length > 4 ? (
            <Text
              allowFontScaling
              style={{
                paddingVertical: 14,
                fontWeight: '700',
              }}
            >
              {t('home.showMore', { count: selection.items.length - 4 })}
            </Text>
          ) : null}

          {selection.showQuietEndState ? (
            <Text
              allowFontScaling
              style={{
                paddingVertical: 20,
                opacity: 0.55,
                fontSize: 13,
              }}
            >
              {t('home.quietEnd')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {state.status === 'error' && state.data ? (
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      ) : null}
    </ScreenFrame>
  );
}
