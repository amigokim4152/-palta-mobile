import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { ActionSurface } from '../../components/home/ActionSurface';
import { GlanceCluster } from '../../components/home/GlanceCluster';
import { SummaryListRow } from '../../components/home/SummaryListRow';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';
import type { HomeRuntimeResponse } from '../../../../src/home/homeRuntimeContract';
import { selectHomeDisplayItems } from '../../../../src/home/selectHomeDisplayItems';

function greetingForNow(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      allowFontScaling
      style={{
        marginBottom: 4,
        fontSize: 12,
        letterSpacing: 0.7,
        fontWeight: '800',
        color: paltaTheme.color.textMuted,
      }}
    >
      {children}
    </Text>
  );
}

export function HomeScreen() {
  const adaptive = useAdaptiveExperience();
  const loadHome = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getHome();
  }, []);

  const { state, refresh } = useAsyncResource(loadHome, {
    isEmpty: (data) => data.items.length === 0,
  });

  const data = state.data as HomeRuntimeResponse | undefined;
  const selection = useMemo(
    () => selectHomeDisplayItems(data?.items ?? []),
    [data?.items],
  );

  const primary = selection.items.find(
    (item) => item.kind === 'action' || item.kind === 'alert',
  ) ?? selection.items.find((item) => item.kind === 'status');

  const secondaryStatus = selection.items.filter(
    (item) => item.kind === 'status' && item.id !== primary?.id,
  );
  const todayItems = selection.items.filter(
    (item) => item.kind === 'useful_today' || item.kind === 'content',
  );

  const openCare = useCallback((careTrackId?: string) => {
    if (!careTrackId) return;
    router.push(`/care/${encodeURIComponent(careTrackId)}`);
  }, []);

  const primaryLabel =
    primary?.kind === 'action' || primary?.kind === 'alert' ? 'AHORA' : 'EN CURSO';

  return (
    <ScreenFrame title="Palta" subtitle="Tu vida, más cerca">
      {state.status === 'loading' && !state.data ? (
        <LoadingState label="Actualizando tu día…" />
      ) : null}

      {state.status === 'error' && !state.data ? (
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      ) : null}

      {data ? (
        <View style={{ gap: 28 }}>
          <View>
            <Text
              allowFontScaling
              style={{
                fontSize: 28,
                lineHeight: 35,
                fontWeight: '700',
                color: paltaTheme.color.textPrimary,
              }}
            >
              {greetingForNow()}
            </Text>
            <Text
              allowFontScaling
              style={{
                marginTop: 3,
                color: paltaTheme.color.textSecondary,
              }}
            >
              {data.locality_label ?? 'Tu zona'}
            </Text>
          </View>

          {data.glance && data.glance.length > 0 ? (
            <GlanceCluster
              items={data.glance}
              columns={adaptive.layout.columns}
              maxItems={adaptive.layout.maxInitialGlanceItems}
            />
          ) : null}

          {primary ? (
            <View>
              <SectionLabel>{primaryLabel}</SectionLabel>
              <ActionSurface
                eyebrow={primary.kind === 'alert' ? 'IMPORTANTE' : undefined}
                title={primary.title}
                body={primary.body}
                actionLabel={primary.care_track_id ? 'Ver seguimiento' : undefined}
                onPress={
                  primary.care_track_id
                    ? () => openCare(primary.care_track_id)
                    : undefined
                }
              />
            </View>
          ) : null}

          {secondaryStatus.length > 0 ? (
            <View>
              <SectionLabel>EN CURSO</SectionLabel>
              {secondaryStatus.map((item) => (
                <SummaryListRow
                  key={item.id}
                  title={item.title}
                  detail={item.body}
                  stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
                  explicitActionLabel={
                    item.care_track_id && adaptive.layout.preferTextLabelsOverIconOnly
                      ? 'Ver seguimiento'
                      : undefined
                  }
                  onPress={
                    item.care_track_id
                      ? () => openCare(item.care_track_id)
                      : undefined
                  }
                />
              ))}
            </View>
          ) : null}

          {todayItems.length > 0 ? (
            <View>
              <SectionLabel>PARA HOY</SectionLabel>
              {todayItems.map((item) => (
                <SummaryListRow
                  key={item.id}
                  title={item.title}
                  detail={
                    adaptive.textScaleClass === 'accessibility'
                      ? undefined
                      : item.body
                  }
                  stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
                  explicitActionLabel={
                    adaptive.layout.preferTextLabelsOverIconOnly ? 'Ver' : undefined
                  }
                />
              ))}
            </View>
          ) : null}

          {selection.items.length === 0 ? (
            <EmptyState
              title="Nada urgente por ahora"
              body="Palta no necesita llenar la pantalla si no hay nada útil que mostrar."
            />
          ) : null}

          {selection.showQuietEndState && selection.items.length > 0 ? (
            <Text
              allowFontScaling
              style={{
                paddingBottom: 24,
                fontSize: 13,
                lineHeight: 19,
                color: paltaTheme.color.textMuted,
              }}
            >
              Nada más requiere tu atención por ahora.
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
