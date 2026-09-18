import { useCallback, useEffect } from 'react';
import { router, useNavigation } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import type { HomeApiItem } from '../../../../src/api/paltaApiClient';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { ErrorState, LoadingState } from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { ActionSurface } from '../../components/home/ActionSurface';
import {
  GlanceCluster,
  type GlanceItem,
} from '../../components/home/GlanceCluster';
import { SummaryListRow } from '../../components/home/SummaryListRow';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';

type HomeSurface = 'now' | 'in_progress' | 'upcoming' | 'useful_today';
type ExtendedHomeItem = HomeApiItem & {
  capability_key?: string;
  surface?: HomeSurface;
  scheduled_at?: string;
  action_label?: string;
  action_target?: string;
  action_kind?: 'internal' | 'external';
  data_mode?: 'live' | 'cached' | 'scheduled' | 'demo' | 'unavailable';
  subject?: { kind: string; id: string; label?: string };
};
type HomeGlance = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  exceptional?: boolean;
  action_target?: string;
  action_kind?: 'internal' | 'external';
};
type HomePayload = {
  generated_at?: string;
  demo_mode?: boolean;
  locality_label?: string;
  context?: {
    locality: { label: string; change_target?: string };
    notifications_target?: string;
    unread_notification_count?: number;
    profile_target?: string;
  };
  glance?: HomeGlance[];
  quiet_state?: { title: string; body?: string };
  items: ExtendedHomeItem[];
};

const DEV_GLANCE: HomeGlance[] = [
  { id: 'dev-weather', label: 'CLIMA', value: '18°', detail: 'Despejado' },
  { id: 'dev-metro', label: 'METRO L1', value: 'Normal', detail: 'Sin incidencias' },
  { id: 'dev-bus', label: 'BUS 405', value: '6 min', detail: 'Parada habitual' },
  { id: 'dev-air', label: 'AIRE', value: 'Bueno', detail: 'Actividad normal' },
];

const DEV_ITEMS: ExtendedHomeItem[] = [
  {
    id: 'dev-now-quote',
    kind: 'alert',
    title: 'Llegó una respuesta a tu cotización',
    body: 'El taller respondió y puedes decidir el siguiente paso.',
    source_domain: 'local-business',
    delivery: 'home',
    surface: 'now',
    data_mode: 'demo',
    action_label: 'Ver respuesta',
  },
  {
    id: 'dev-upcoming-health',
    kind: 'content',
    title: 'Consulta médica',
    body: 'Revisa los documentos que debes llevar.',
    source_domain: 'health',
    delivery: 'home',
    surface: 'upcoming',
    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    data_mode: 'demo',
  },
  {
    id: 'dev-today-municipal',
    kind: 'content',
    title: 'Beneficio municipal cercano',
    body: 'Sólo aparece cuando corresponde a tu situación y zona.',
    source_domain: 'public-life',
    delivery: 'home',
    surface: 'useful_today',
    data_mode: 'demo',
  },
  {
    id: 'dev-today-local',
    kind: 'content',
    title: 'Información local relevante para hoy',
    body: 'Noticias y cambios recientes que realmente afectan tu día.',
    source_domain: 'local-life',
    delivery: 'home',
    surface: 'useful_today',
    data_mode: 'demo',
  },
];

function isDevelopment() {
  return process.env.EXPO_PUBLIC_ENV === 'development';
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      allowFontScaling
      style={{
        marginBottom: 5,
        fontSize: 11,
        letterSpacing: 0.75,
        fontWeight: '800',
        color: paltaTheme.color.textMuted,
      }}
    >
      {children}
    </Text>
  );
}

function greetingForNow(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function itemSurface(item: ExtendedHomeItem): HomeSurface {
  if (item.surface) return item.surface;
  if (item.kind === 'action' || item.kind === 'alert') return 'now';
  if (item.kind === 'status') return 'in_progress';
  return 'useful_today';
}

function domainLabel(domain: string): string {
  const labels: Record<string, string> = {
    weather: 'Clima',
    mobility: 'Movilidad',
    care: 'Seguimiento',
    commerce: 'Pedido',
    'public-life': 'Municipalidad',
    community: 'Comunidad',
    school: 'Colegio',
    health: 'Salud',
    vehicle: 'Vehículo',
    pets: 'Mascota',
    news: 'Noticias',
    'local-life': 'Vida local',
    'local-business': 'Negocios',
  };
  return labels[domain] ?? 'Palta';
}

function scheduledMeta(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function openTarget(target?: string, kind?: 'internal' | 'external') {
  if (!target) return;
  if (kind === 'external') {
    await Linking.openURL(target);
    return;
  }
  router.push(target as never);
}

function targetForItem(item: ExtendedHomeItem): string | undefined {
  if (item.action_target) return item.action_target;
  if (item.care_track_id) return `/care/${encodeURIComponent(item.care_track_id)}`;
  return undefined;
}

function actionLabelForItem(item: ExtendedHomeItem): string | undefined {
  if (item.action_label) return item.action_label;
  if (item.care_track_id) return 'Ver seguimiento';
  return undefined;
}

function itemMeta(item: ExtendedHomeItem): string {
  const domain = domainLabel(item.source_domain);
  return item.subject?.label ? `${domain} · ${item.subject.label}` : domain;
}

function withDevelopmentPreview(data: HomePayload): HomePayload {
  if (!isDevelopment()) return data;
  const existingIds = new Set(data.items.map((item) => item.id));
  const hasNow = data.items.some((item) => itemSurface(item) === 'now');
  const hasUpcoming = data.items.some((item) => itemSurface(item) === 'upcoming');
  const hasUseful = data.items.some((item) => itemSurface(item) === 'useful_today');
  const additions = DEV_ITEMS.filter((item) => {
    if (existingIds.has(item.id)) return false;
    if (item.surface === 'now' && hasNow) return false;
    if (item.surface === 'upcoming' && hasUpcoming) return false;
    if (item.surface === 'useful_today' && hasUseful) return false;
    return true;
  });
  return {
    ...data,
    demo_mode: data.demo_mode ?? true,
    locality_label: data.locality_label ?? 'Vitacura',
    glance: data.glance?.length ? data.glance : DEV_GLANCE,
    items: [...data.items, ...additions],
  };
}

export function HomeScreen() {
  const adaptive = useAdaptiveExperience();
  const navigation = useNavigation();

  const loadHome = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const payload = (await mobileRuntime.client.getHome()) as HomePayload;
    return withDevelopmentPreview(payload);
  }, []);

  const { state, refresh } = useAsyncResource(loadHome);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void refresh());
    return unsubscribe;
  }, [navigation, refresh]);

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Palta">
        <LoadingState label="Actualizando tu día…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Palta">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const data = state.data;
  if (!data) {
    return (
      <ScreenFrame title="Palta">
        <Text allowFontScaling>No hay información disponible.</Text>
      </ScreenFrame>
    );
  }

  const items = data.items;
  const nowItems = items.filter((item) => itemSurface(item) === 'now');
  const inProgressItems = items.filter((item) => itemSurface(item) === 'in_progress');
  const upcomingItems = items.filter((item) => itemSurface(item) === 'upcoming');
  const usefulTodayItems = items.filter((item) => itemSurface(item) === 'useful_today');
  const glanceItems: GlanceItem[] = (data.glance ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    value: item.value,
    ...(item.detail ? { detail: item.detail } : {}),
    ...(item.exceptional !== undefined ? { exceptional: item.exceptional } : {}),
    ...(item.action_target
      ? { onPress: () => void openTarget(item.action_target, item.action_kind) }
      : {}),
  }));
  const locality = data.context?.locality.label ?? data.locality_label ?? 'Tu zona';

  return (
    <ScreenFrame title="Palta">
      <View style={{ gap: 20 }}>
        <View>
          <Text
            allowFontScaling
            style={{
              fontSize: 25,
              lineHeight: 31,
              fontWeight: '700',
              color: paltaTheme.color.textPrimary,
            }}
          >
            {greetingForNow()}
          </Text>
          <View
            style={{
              marginTop: 2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Pressable
              accessibilityRole={data.context?.locality.change_target ? 'button' : undefined}
              disabled={!data.context?.locality.change_target}
              onPress={
                data.context?.locality.change_target
                  ? () => void openTarget(data.context?.locality.change_target, 'internal')
                  : undefined
              }
              style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}>{locality}</Text>
            </Pressable>
            {data.context ? (
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <Pressable
                  disabled={!data.context.notifications_target}
                  onPress={() => void openTarget(data.context?.notifications_target, 'internal')}
                  style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.brandPrimary }}>
                    {data.context.unread_notification_count
                      ? `Avisos ${data.context.unread_notification_count}`
                      : 'Avisos'}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={!data.context.profile_target}
                  onPress={() => void openTarget(data.context?.profile_target, 'internal')}
                  style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.brandPrimary }}>
                    Perfil
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {data.demo_mode ? (
          <View
            style={{
              alignSelf: 'flex-start',
              borderRadius: paltaTheme.radius.pill,
              backgroundColor: paltaTheme.color.surfaceMuted,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: paltaTheme.color.textMuted }}>
              Vista de demostración · datos de ejemplo
            </Text>
          </View>
        ) : null}

        {glanceItems.length ? (
          <GlanceCluster
            items={glanceItems}
            columns={adaptive.layout.columns}
            maxItems={adaptive.layout.maxInitialGlanceItems}
          />
        ) : null}

        {nowItems.length ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>AHORA</SectionLabel>
            {nowItems.map((item) => {
              const target = targetForItem(item);
              return (
                <ActionSurface
                  key={item.id}
                  eyebrow={`${domainLabel(item.source_domain).toUpperCase()} · AHORA`}
                  title={item.title}
                  body={item.body}
                  actionLabel={actionLabelForItem(item)}
                  onPress={target ? () => void openTarget(target, item.action_kind) : undefined}
                />
              );
            })}
          </View>
        ) : null}

        {inProgressItems.length ? (
          <View>
            <SectionLabel>EN CURSO</SectionLabel>
            {inProgressItems.map((item) => {
              const target = targetForItem(item);
              return (
                <SummaryListRow
                  key={item.id}
                  title={item.title}
                  meta={itemMeta(item)}
                  detail={item.body}
                  explicitActionLabel={actionLabelForItem(item)}
                  onPress={target ? () => void openTarget(target, item.action_kind) : undefined}
                  stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
                />
              );
            })}
          </View>
        ) : null}

        {upcomingItems.length ? (
          <View>
            <SectionLabel>PRÓXIMO</SectionLabel>
            {upcomingItems.map((item) => (
              <SummaryListRow
                key={item.id}
                title={item.title}
                meta={[itemMeta(item), scheduledMeta(item.scheduled_at)].filter(Boolean).join(' · ')}
                detail={item.body}
                stackMeta
              />
            ))}
          </View>
        ) : null}

        {usefulTodayItems.length ? (
          <View>
            <SectionLabel>PARA HOY</SectionLabel>
            {usefulTodayItems.map((item) => (
              <SummaryListRow
                key={item.id}
                title={item.title}
                meta={itemMeta(item)}
                detail={adaptive.textScaleClass === 'accessibility' ? undefined : item.body}
                stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
              />
            ))}
          </View>
        ) : null}

        {data.quiet_state || items.length === 0 ? (
          <Text
            allowFontScaling
            style={{ paddingBottom: 24, fontSize: 13, lineHeight: 19, color: paltaTheme.color.textMuted }}
          >
            {data.quiet_state?.title ?? 'Nada más requiere tu atención por ahora.'}
          </Text>
        ) : null}

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
