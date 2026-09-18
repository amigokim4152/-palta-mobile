import { useCallback, useEffect } from 'react';
import { router, useNavigation } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import type {
  HomeApiGlanceItem,
  HomeApiItem,
  HomeApiSurface,
} from '../../../../src/api/paltaApiClient';
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
import { missingLegacyLifeCardDemoItems } from './demoLegacyLifeCards';

const DETAILED_SEASONAL_FOOD_KEYS = new Set([
  'today.seasonal_fruit',
  'today.seasonal_vegetable',
  'today.seasonal_seafood',
]);

function demoSeasonalFoodItems(): HomeApiItem[] {
  return [
    {
      id: 'home-seasonal-fruit-demo',
      capability_key: 'today.seasonal_fruit',
      kind: 'content',
      title: 'Frutas de temporada',
      body: 'Ejemplo: frutilla · kiwi · naranja',
      source_domain: 'food',
      delivery: 'home',
      surface: 'useful_today',
      data_mode: 'demo',
      dedupe_key: 'food:seasonal:fruit:demo',
      relevance: 0.72,
    },
    {
      id: 'home-seasonal-vegetable-demo',
      capability_key: 'today.seasonal_vegetable',
      kind: 'content',
      title: 'Verduras de temporada',
      body: 'Ejemplo: alcachofa · espárrago · espinaca',
      source_domain: 'food',
      delivery: 'home',
      surface: 'useful_today',
      data_mode: 'demo',
      dedupe_key: 'food:seasonal:vegetable:demo',
      relevance: 0.7,
    },
    {
      id: 'home-seasonal-seafood-demo',
      capability_key: 'today.seasonal_seafood',
      kind: 'content',
      title: 'Pescados y mariscos de temporada',
      body: 'Ejemplo: merluza · reineta · jurel',
      source_domain: 'food',
      delivery: 'home',
      surface: 'useful_today',
      data_mode: 'demo',
      dedupe_key: 'food:seasonal:seafood:demo',
      relevance: 0.7,
    },
  ];
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

function fallbackSurface(item: HomeApiItem): HomeApiSurface {
  if (item.kind === 'action' || item.kind === 'alert') return 'now';
  if (item.kind === 'status') return 'in_progress';
  return 'useful_today';
}

function itemSurface(item: HomeApiItem): HomeApiSurface {
  return item.surface ?? fallbackSurface(item);
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
    food: 'Alimentos',
    play: 'Panoramas',
    economy: 'Economía',
    fuel: 'Combustible',
    traffic: 'Tránsito',
    road: 'Rutas',
    border: 'Frontera',
    marine: 'Mar',
    safety: 'Seguridad',
    message: 'Mensajes',
    'local-business': 'Negocios',
  };
  return labels[domain] ?? 'Palta';
}

function scheduledMeta(value: string | undefined): string | undefined {
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

function itemContextMeta(item: HomeApiItem): string {
  const domain = domainLabel(item.source_domain);
  const subject = item.subject?.label?.trim();
  return subject ? `${domain} · ${subject}` : domain;
}

function upcomingMeta(item: HomeApiItem): string | undefined {
  const context = itemContextMeta(item);
  const schedule = scheduledMeta(item.scheduled_at);
  if (!schedule) return context;
  return `${context} · ${schedule}`;
}

async function openTarget(
  target: string | undefined,
  kind: 'internal' | 'external' | undefined,
) {
  if (!target) return;
  if (kind === 'external') {
    await Linking.openURL(target);
    return;
  }
  router.push(target as never);
}

function itemPress(item: HomeApiItem): (() => void) | undefined {
  if (!item.action_target) return undefined;
  return () => {
    void openTarget(item.action_target, item.action_kind);
  };
}

function glancePress(item: HomeApiGlanceItem): (() => void) | undefined {
  if (!item.action_target) return undefined;
  return () => {
    void openTarget(item.action_target, item.action_kind);
  };
}

function ContextAction({
  label,
  target,
}: {
  label: string;
  target?: string;
}) {
  return (
    <Pressable
      accessibilityRole={target ? 'button' : undefined}
      disabled={!target}
      onPress={target ? () => void openTarget(target, 'internal') : undefined}
      style={{
        minHeight: paltaTheme.touch.minimum,
        justifyContent: 'center',
        paddingHorizontal: 2,
      }}
    >
      <Text
        allowFontScaling
        style={{
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '700',
          color: target
            ? paltaTheme.color.brandPrimary
            : paltaTheme.color.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function HomeScreen() {
  const adaptive = useAdaptiveExperience();
  const navigation = useNavigation();

  const loadHome = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getHome();
  }, []);

  const { state, refresh } = useAsyncResource(loadHome);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void refresh();
    });
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

  const context = data.context;
  const localityLabel = context?.locality.label ?? data.locality_label ?? 'Tu zona';
  const demoMode =
    data.demo_mode === true ||
    (data.glance ?? []).some((item) => item.data_mode === 'demo') ||
    data.items.some((item) => item.data_mode === 'demo');

  const completeDemoItems = demoMode
    ? missingLegacyLifeCardDemoItems(data.items)
    : [];
  const homeItems = demoMode ? [...data.items, ...completeDemoItems] : data.items;

  const nowItems = homeItems.filter((item) => itemSurface(item) === 'now');
  const inProgressItems = homeItems.filter(
    (item) => itemSurface(item) === 'in_progress',
  );
  const upcomingItems = homeItems.filter(
    (item) => itemSurface(item) === 'upcoming',
  );
  const rawUsefulTodayItems = homeItems.filter(
    (item) => itemSurface(item) === 'useful_today',
  );

  const hasDetailedSeasonalFood = homeItems.some(
    (item) =>
      typeof item.capability_key === 'string' &&
      DETAILED_SEASONAL_FOOD_KEYS.has(item.capability_key),
  );

  const usefulTodayItems =
    demoMode && !hasDetailedSeasonalFood
      ? [
          ...rawUsefulTodayItems.filter(
            (item) => item.capability_key !== 'today.seasonal_food',
          ),
          ...demoSeasonalFoodItems(),
        ]
      : rawUsefulTodayItems;

  const glanceItems: GlanceItem[] = (data.glance ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    value: item.value,
    ...(item.detail ? { detail: item.detail } : {}),
    ...(item.exceptional !== undefined ? { exceptional: item.exceptional } : {}),
    ...(item.action_target ? { onPress: glancePress(item) } : {}),
  }));

  const noActiveItems =
    nowItems.length === 0 &&
    inProgressItems.length === 0 &&
    upcomingItems.length === 0 &&
    usefulTodayItems.length === 0;

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
              accessibilityRole={context?.locality.change_target ? 'button' : undefined}
              disabled={!context?.locality.change_target}
              onPress={
                context?.locality.change_target
                  ? () => void openTarget(context.locality.change_target, 'internal')
                  : undefined
              }
              style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center' }}
            >
              <Text
                allowFontScaling
                style={{
                  fontSize: 14,
                  lineHeight: 19,
                  color: paltaTheme.color.textSecondary,
                }}
              >
                {localityLabel}
              </Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <ContextAction
                label={
                  context?.unread_notification_count
                    ? `Avisos ${context.unread_notification_count}`
                    : 'Avisos'
                }
                target={context?.notifications_target}
              />
              <ContextAction label="Perfil" target={context?.profile_target} />
            </View>
          </View>
        </View>

        {demoMode ? (
          <View
            style={{
              alignSelf: 'flex-start',
              borderRadius: paltaTheme.radius.pill,
              backgroundColor: paltaTheme.color.brandSoft,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text
              allowFontScaling
              style={{
                fontSize: 11,
                lineHeight: 15,
                fontWeight: '700',
                color: paltaTheme.color.brandPrimary,
              }}
            >
              Vista de demostración · datos de ejemplo
            </Text>
          </View>
        ) : null}

        {glanceItems.length > 0 ? (
          <GlanceCluster
            items={glanceItems}
            columns={adaptive.layout.columns}
            maxItems={adaptive.layout.maxInitialGlanceItems}
          />
        ) : null}

        {nowItems.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>AHORA</SectionLabel>
            {nowItems.map((item) => (
              <ActionSurface
                key={item.id}
                eyebrow={`${domainLabel(item.source_domain).toUpperCase()} · AHORA`}
                title={item.title}
                body={item.body}
                actionLabel={item.action_label}
                onPress={itemPress(item)}
              />
            ))}
          </View>
        ) : null}

        {inProgressItems.length > 0 ? (
          <View>
            <SectionLabel>EN CURSO</SectionLabel>
            {inProgressItems.map((item) => (
              <SummaryListRow
                key={item.id}
                title={item.title}
                meta={itemContextMeta(item)}
                detail={item.body}
                explicitActionLabel={item.action_label}
                onPress={itemPress(item)}
                stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
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
                meta={upcomingMeta(item)}
                detail={item.body}
                explicitActionLabel={item.action_label}
                onPress={itemPress(item)}
                stackMeta
              />
            ))}
          </View>
        ) : null}

        {usefulTodayItems.length > 0 ? (
          <View>
            <SectionLabel>PARA HOY</SectionLabel>
            {usefulTodayItems.map((item) => (
              <SummaryListRow
                key={item.id}
                title={item.title}
                meta={itemContextMeta(item)}
                detail={
                  adaptive.textScaleClass === 'accessibility'
                    ? undefined
                    : item.body
                }
                explicitActionLabel={item.action_label}
                onPress={itemPress(item)}
                stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
              />
            ))}
          </View>
        ) : null}

        {noActiveItems || data.quiet_state ? (
          <Text
            allowFontScaling
            style={{
              paddingBottom: 24,
              fontSize: 13,
              lineHeight: 19,
              color: paltaTheme.color.textMuted,
            }}
          >
            {data.quiet_state?.title ?? 'Nada urgente por ahora.'}
          </Text>
        ) : null}

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
