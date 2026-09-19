import { useCallback, useEffect, useState } from 'react';
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
import { homeDisplayMode, prepareHomeDisplay } from '../../../../src/home/homeDisplayPolicy';
import { LEGACY_LIFE_CARD_DEMO_ITEMS } from './demoLegacyLifeCards';
import { DEMO_HOME_ENTRIES } from './demoHomeEntries';

const DETAILED_SEASONAL_FOOD_KEYS = new Set([
  'today.seasonal_fruit',
  'today.seasonal_vegetable',
  'today.seasonal_seafood',
]);

const COMPACT_ECONOMY_KEYS = new Set([
  'today.exchange_rate',
  'today.uf',
]);

const COMPACT_LIFE_INFO_KEYS = new Set([
  ...DETAILED_SEASONAL_FOOD_KEYS,
  ...COMPACT_ECONOMY_KEYS,
]);

const SEASONAL_SHORT_LABEL: Record<string, string> = {
  'today.seasonal_fruit': 'Fruta',
  'today.seasonal_vegetable': 'Verdura',
  'today.seasonal_seafood': 'Mar',
};

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
  const domain =
    item.capability_key === 'today.municipal_benefit'
      ? 'Beneficio local'
      : domainLabel(item.source_domain);
  const subject = item.subject?.label?.trim();
  return subject ? `${domain} · ${subject}` : domain;
}

function upcomingMeta(item: HomeApiItem): string | undefined {
  const context = itemContextMeta(item);
  const schedule = scheduledMeta(item.scheduled_at);
  if (!schedule) return context;
  return `${context} · ${schedule}`;
}

function compactBody(item: HomeApiItem): string {
  const body = item.body?.replace(/^Ejemplo:\s*/i, '').trim();
  return body || item.title;
}

function firstCompactValue(item: HomeApiItem): string {
  return compactBody(item).split('·')[0]?.trim() || item.title;
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

function firstGroupPress(items: readonly HomeApiItem[]): (() => void) | undefined {
  const actionable = items.find((item) => Boolean(item.action_target));
  return actionable ? itemPress(actionable) : undefined;
}

function CompactLifeSummary({ items }: { items: readonly HomeApiItem[] }) {
  const economy = items.filter((item) =>
    item.capability_key ? COMPACT_ECONOMY_KEYS.has(item.capability_key) : false,
  );
  const seasonal = items.filter((item) =>
    item.capability_key ? DETAILED_SEASONAL_FOOD_KEYS.has(item.capability_key) : false,
  );

  const rows: Array<{
    id: string;
    label: string;
    value: string;
    onPress?: () => void;
  }> = [];

  if (economy.length > 0) {
    rows.push({
      id: 'compact-economy',
      label: 'Economía',
      value: economy.map((item) => compactBody(item)).join(' · '),
      ...(firstGroupPress(economy) ? { onPress: firstGroupPress(economy) } : {}),
    });
  }

  if (seasonal.length > 0) {
    rows.push({
      id: 'compact-seasonal-food',
      label: 'De temporada',
      value: seasonal
        .map((item) => {
          const label = item.capability_key
            ? SEASONAL_SHORT_LABEL[item.capability_key] ?? 'Temporada'
            : 'Temporada';
          return `${label}: ${firstCompactValue(item)}`;
        })
        .join(' · '),
      ...(firstGroupPress(seasonal) ? { onPress: firstGroupPress(seasonal) } : {}),
    });
  }

  if (rows.length === 0) return null;

  return (
    <View
      accessibilityLabel="Datos útiles de hoy"
      style={{
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: paltaTheme.color.divider,
      }}
    >
      {rows.map((row, index) => (
        <Pressable
          key={row.id}
          accessibilityRole={row.onPress ? 'button' : undefined}
          disabled={!row.onPress}
          onPress={row.onPress}
          style={{
            minHeight: paltaTheme.touch.minimum,
            paddingVertical: 7,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderBottomWidth: index < rows.length - 1 ? 1 : 0,
            borderColor: paltaTheme.color.divider,
          }}
        >
          <Text
            allowFontScaling
            style={{
              width: 82,
              fontSize: 12,
              lineHeight: 17,
              fontWeight: '700',
              color: paltaTheme.color.textSecondary,
            }}
          >
            {row.label}
          </Text>
          <Text
            allowFontScaling
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              flex: 1,
              fontSize: 13,
              lineHeight: 18,
              color: paltaTheme.color.textPrimary,
            }}
          >
            {row.value}
          </Text>
        </Pressable>
      ))}
    </View>
  );
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
  const [showAllDemo, setShowAllDemo] = useState(false);
  const [showAllGlance, setShowAllGlance] = useState(false);
  const environment = mobileRuntime.status === 'ready'
    ? mobileRuntime.environment
    : process.env.EXPO_PUBLIC_ENV ?? 'development';
  const developmentDemo = homeDisplayMode(environment) === 'development_demo';

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

  if (state.status === 'loading' && !state.data && !developmentDemo) {
    return (
      <ScreenFrame title="Palta">
        <LoadingState label="Actualizando tu día…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data && !developmentDemo) {
    return (
      <ScreenFrame title="Palta">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const data = prepareHomeDisplay(state.data, environment, LEGACY_LIFE_CARD_DEMO_ITEMS);
  if (!state.data && !developmentDemo) {
    return (
      <ScreenFrame title="Palta">
        <Text allowFontScaling>No hay información disponible.</Text>
      </ScreenFrame>
    );
  }

  const context = data.context;
  const localityLabel = context?.locality.label ?? data.locality_label ?? 'Tu zona';
  const demoMode = developmentDemo;
  const homeItems = data.items;

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

  const preparedUsefulTodayItems =
    demoMode && !hasDetailedSeasonalFood
      ? [
          ...rawUsefulTodayItems.filter(
            (item) => item.capability_key !== 'today.seasonal_food',
          ),
          ...demoSeasonalFoodItems(),
        ]
      : rawUsefulTodayItems;

  const compactLifeItems =
    adaptive.textScaleClass === 'accessibility'
      ? []
      : preparedUsefulTodayItems.filter(
          (item) =>
            typeof item.capability_key === 'string' &&
            COMPACT_LIFE_INFO_KEYS.has(item.capability_key),
        );

  const usefulTodayItems =
    compactLifeItems.length === 0
      ? preparedUsefulTodayItems
      : preparedUsefulTodayItems.filter(
          (item) =>
            !item.capability_key ||
            !COMPACT_LIFE_INFO_KEYS.has(item.capability_key),
        );

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
    usefulTodayItems.length === 0 &&
    compactLifeItems.length === 0;

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
            maxItems={showAllGlance ? glanceItems.length : adaptive.layout.maxInitialGlanceItems}
            onMore={() => setShowAllGlance(true)}
          />
        ) : null}

        {nowItems.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>AHORA</SectionLabel>
            {(demoMode && !showAllDemo ? nowItems.slice(0, 2) : nowItems).map((item) => (
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

        {compactLifeItems.length > 0 || usefulTodayItems.length > 0 ? (
          <View style={{ gap: compactLifeItems.length > 0 ? 6 : 0 }}>
            <SectionLabel>PARA HOY</SectionLabel>
            {compactLifeItems.length > 0 ? (
              <CompactLifeSummary items={compactLifeItems} />
            ) : null}
            {(demoMode && !showAllDemo ? usefulTodayItems.slice(0, 6) : usefulTodayItems).map((item) => (
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

        {demoMode ? (
          <View style={{ gap: 6 }}>
            <SectionLabel>EXPLORA PALTA</SectionLabel>
            {(showAllDemo ? DEMO_HOME_ENTRIES : DEMO_HOME_ENTRIES.slice(0, 5)).map((entry) => (
              <SummaryListRow
                key={entry.capabilityKey}
                title={entry.title}
                detail={adaptive.textScaleClass === 'accessibility' ? undefined : entry.detail}
                onPress={entry.target ? () => void openTarget(entry.target, 'internal') : undefined}
                stackMeta={!adaptive.layout.allowHorizontalMetadataCompression}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showAllDemo ? 'Mostrar menos funciones' : 'Ver todas las funciones y tarjetas de ejemplo'}
              onPress={() => setShowAllDemo((shown) => !shown)}
              style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center' }}
            >
              <Text allowFontScaling style={{ color: paltaTheme.color.brandPrimary, fontWeight: '700' }}>
                {showAllDemo ? 'Ver menos' : 'Ver todo'}
              </Text>
            </Pressable>
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
