import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { Linking, Text, View } from 'react-native';
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

function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function formatScheduledAt(value?: string, now = new Date()): string | undefined {
  if (!value) return undefined;
  const scheduled = new Date(value);
  if (!Number.isFinite(scheduled.getTime())) return undefined;

  const time = scheduled.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (localDateKey(scheduled) === localDateKey(now)) return `Hoy · ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (localDateKey(scheduled) === localDateKey(tomorrow)) return `Mañana · ${time}`;

  const date = scheduled.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
  });
  return `${date} · ${time}`;
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

  const primary =
    selection.items.find(
      (item) => item.kind === 'action' || item.kind === 'alert',
    ) ??
    selection.items.find(
      (item) => item.kind === 'status' && !item.scheduled_at,
    );

  const secondaryStatus = selection.items.filter(
    (item) =>
      item.kind === 'status' &&
      !item.scheduled_at &&
      item.id !== primary?.id,
  );

  const upcomingItems = selection.items
    .filter((item) => item.kind === 'status' && Boolean(item.scheduled_at))
    .sort(
      (a, b) =>
        Date.parse(a.scheduled_at ?? '') - Date.parse(b.scheduled_at ?? ''),
    );

  const todayItems = selection.items.filter(
    (item) =>
      !item.scheduled_at &&
      (item.kind === 'useful_today' || item.kind === 'content'),
  );

  const hasDemoData =
    data?.source_state?.some((item) => item.data_mode === 'demo') ?? false;

  const openItem = useCallback(
    async (item: HomeRuntimeResponse['items'][number]) => {
      if (item.care_track_id) {
        router.push(`/care/${encodeURIComponent(item.care_track_id)}`);
        return;
      }
      if (!item.action_target) return;

      if (item.action_kind === 'external') {
        try {
          if (await Linking.canOpenURL(item.action_target)) {
            await Linking.openURL(item.action_target);
          }
        } catch {
          // Source remains visible; a temporary OS/browser failure must not crash Home.
        }
        return;
      }

      router.push(item.action_target as never);
    },
    [],
  );

  const hasAction = useCallback(
    (item: HomeRuntimeResponse['items'][number]) =>
      Boolean(item.care_track_id || item.action_target),
    [],
  );

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

          {hasDemoData ? (
            <View
              accessibilityRole="text"
              style={{
                marginTop: -18,
                alignSelf: 'flex-start',
                borderRadius: paltaTheme.radius.pill,
                backgroundColor: paltaTheme.color.surfaceMuted,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text
                allowFontScaling
                style={{
                  fontSize: 12,
                  lineHeight: 16,
                  fontWeight: '700',
                  color: paltaTheme.color.textMuted,
                }}
              >
                Vista de desarrollo · datos de ejemplo
              </Text>
            </View>
          ) : null}

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
                actionLabel={
                  primary.care_track_id
                    ? 'Ver seguimiento'
                    : primary.action_label
                }
                onPress={
                  hasAction(primary) ? () => void openItem(primary) : undefined
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
                    hasAction(item) && adaptive.layout.preferTextLabelsOverIconOnly
                      ? item.care_track_id
                        ? 'Ver seguimiento'
                        : item.action_label
                      : undefined
                  }
                  onPress={
                    hasAction(item) ? () => void openItem(item) : undefined
                  }
                />
              ))}
            </View>
          ) : null}

          {upcomingItems.length > 0 ? (
            <View>
              <SectionLabel>PRÓXIMO</SectionLabel>
              {upcomingItems.map((item) => (
                <SummaryListRow
                  key={item.id}
                  title={item.title}
                  meta={formatScheduledAt(item.scheduled_at)}
                  detail={
                    adaptive.textScaleClass === 'accessibility'
                      ? undefined
                      : item.body
                  }
                  stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
                  explicitActionLabel={
                    hasAction(item) && adaptive.layout.preferTextLabelsOverIconOnly
                      ? item.action_label ?? 'Ver detalle'
                      : undefined
                  }
                  onPress={
                    hasAction(item) ? () => void openItem(item) : undefined
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
                    hasAction(item) && adaptive.layout.preferTextLabelsOverIconOnly
                      ? item.action_label ?? 'Ver'
                      : undefined
                  }
                  onPress={
                    hasAction(item) ? () => void openItem(item) : undefined
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
