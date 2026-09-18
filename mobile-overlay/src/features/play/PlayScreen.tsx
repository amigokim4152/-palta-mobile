import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { composePlayFeed } from '../../../../src/play/playFeedComposer';
import {
  selectPlayDiscoveryItems,
  type PlayDiscoveryItem,
  type PlayThemeKey,
} from '../../../../src/play/playDiscovery';
import {
  playContentDefinition,
  type PlayContentKind,
} from '../../../../src/play/playContentTaxonomy';
import { ScreenFrame } from '../../components/ScreenFrame';
import { FilterChip } from '../../components/common/FilterChip';
import { PaltaButton } from '../../components/common/PaltaButton';
import { SectionHeading } from '../../components/common/SectionHeading';
import { paltaTheme } from '../../theme/paltaTheme';
import { playPreviewItems } from './playPreviewData';

const themeOptions: ReadonlyArray<{ key: PlayThemeKey; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: 'weekend', label: 'Este finde' },
  { key: 'family', label: 'Con niños' },
  { key: 'couple', label: 'En pareja' },
  { key: 'free', label: 'Gratis' },
  { key: 'outdoor', label: 'Aire libre' },
  { key: 'birthday', label: 'Cumpleaños' },
];

const contentOptions: ReadonlyArray<{ key: PlayContentKind; label: string }> = [
  { key: 'movie', label: 'Cine' },
  { key: 'live_performance', label: 'Espectáculos' },
  { key: 'exhibition', label: 'Exposiciones' },
  { key: 'sports_event', label: 'Deportes' },
  { key: 'park', label: 'Parques' },
  { key: 'active_leisure', label: 'Actividades' },
  { key: 'day_trip', label: 'Escapadas' },
  { key: 'food_outing', label: 'Comer' },
];

const sectionCopy: Record<PlayThemeKey, { title: string; subtitle: string }> = {
  today: {
    title: 'Hoy cerca de ti',
    subtitle: 'Actividades públicas y municipales que puedes aprovechar hoy.',
  },
  weekend: {
    title: 'Este fin de semana',
    subtitle: 'Planes cercanos ordenados por momento, zona y utilidad.',
  },
  family: {
    title: 'Para hacer en familia',
    subtitle: 'Actividades y lugares que funcionan bien con niños.',
  },
  couple: {
    title: 'Para salir en pareja',
    subtitle: 'Cine, cultura, comida y otros panoramas para compartir de a dos.',
  },
  free: {
    title: 'Gratis cerca de ti',
    subtitle: 'Panoramas públicos y otras opciones sin costo.',
  },
  outdoor: {
    title: 'Al aire libre',
    subtitle: 'Parques, ferias, actividades y lugares para aprovechar afuera.',
  },
  birthday: {
    title: 'Cumpleaños',
    subtitle: 'Piscina, parcela, juegos, karting y otras experiencias para celebrar.',
  },
};

const kindSubtitle: Partial<Record<PlayContentKind, string>> = {
  movie: 'Cartelera, horarios y cines cercanos en un solo lugar.',
  live_performance: 'Teatro, música, comedia y salas pequeñas cerca de ti.',
  exhibition: 'Exposiciones, galerías y cultura para visitar hoy o esta semana.',
  sports_event: 'Partidos, campeonatos y actividades deportivas de tu zona.',
  park: 'Parques, plazas y espacios para salir sin complicarte.',
  active_leisure: 'Karting, bowling, trampolines, escalada y otras experiencias.',
  day_trip: 'Ideas para salir de la rutina sin perder de vista la distancia.',
  food_outing: 'Lugares para comer o tomar algo como parte del panorama.',
};

function sourceLabel(item: PlayDiscoveryItem): string {
  if (item.sourceKind === 'municipal_event') return 'Municipal';
  if (item.sourceKind === 'public_program') return 'Público';
  if (item.sourceKind === 'business') return 'Negocio';
  if (item.sourceKind === 'partner_feed') return 'Cartelera';
  if (item.sourceKind === 'editorial') return 'Selección';
  return 'Lugar';
}

function businessIdFor(item: PlayDiscoveryItem): string | undefined {
  return item.businessProjection?.businessId ?? item.businessId;
}

function actionLabel(item: PlayDiscoveryItem): string {
  const action = item.primaryAction;
  if (!action) return 'Ver detalles';
  if (action.label?.trim()) return action.label.trim();
  if (action.kind === 'registration') return 'Inscribirme';
  if (action.kind === 'ticket') return 'Ver entradas';
  if (action.kind === 'reservation') return 'Reservar';
  return 'Ver información';
}

function openExternal(url?: string) {
  if (!url) return;
  void Linking.openURL(url);
}

function itemSubtitle(item: PlayDiscoveryItem): string {
  return [
    item.scheduleLabel,
    item.venue,
    item.comuna,
    item.distanceLabel,
  ]
    .filter(Boolean)
    .join(' · ');
}

function itemMeta(item: PlayDiscoveryItem): string {
  return [
    item.isFree ? 'Gratis' : item.priceLabel,
    item.audienceLabel,
    sourceLabel(item),
  ]
    .filter(Boolean)
    .join(' · ');
}

function contentKindLabel(kind: PlayContentKind): string {
  return playContentDefinition(kind).labelEs;
}

export function PlayScreen() {
  const [selectedTheme, setSelectedTheme] = useState<PlayThemeKey>('today');
  const [selectedContentKind, setSelectedContentKind] = useState<PlayContentKind | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlayDiscoveryItem | null>(null);

  const feed = useMemo(
    () => composePlayFeed(playPreviewItems, { locality: 'Vitacura', selectedTheme }),
    [selectedTheme],
  );

  const visibleItems = useMemo(() => {
    const selected = selectPlayDiscoveryItems(feed.items, {
      locality: 'Vitacura',
      selectedTheme,
    });
    return selectedContentKind
      ? selected.filter((item) => item.contentKind === selectedContentKind)
      : selected;
  }, [feed.items, selectedContentKind, selectedTheme]);

  const selectedSection = sectionCopy[selectedTheme];

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={{ paddingBottom: paltaTheme.spacing.xxl }}>
        <View style={{ gap: paltaTheme.spacing.xs, marginBottom: paltaTheme.spacing.lg }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: paltaTheme.colors.textPrimary }}>
            Panoramas
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 21, color: paltaTheme.colors.textSecondary }}>
            Qué hacer cerca de ti, empezando por lo público y útil.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: paltaTheme.spacing.sm, paddingBottom: paltaTheme.spacing.md }}
        >
          {themeOptions.map((option) => (
            <FilterChip
              key={option.key}
              label={option.label}
              selected={selectedTheme === option.key}
              onPress={() => setSelectedTheme(option.key)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: paltaTheme.spacing.sm, paddingBottom: paltaTheme.spacing.lg }}
        >
          <FilterChip
            label="Todo"
            selected={selectedContentKind === null}
            onPress={() => setSelectedContentKind(null)}
          />
          {contentOptions.map((option) => (
            <FilterChip
              key={option.key}
              label={option.label}
              selected={selectedContentKind === option.key}
              onPress={() => setSelectedContentKind(option.key)}
            />
          ))}
        </ScrollView>

        <SectionHeading title={selectedSection.title} subtitle={selectedSection.subtitle} />

        <View style={{ gap: paltaTheme.spacing.md }}>
          {visibleItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedItem(item)}
              style={{
                borderRadius: paltaTheme.radius.lg,
                backgroundColor: paltaTheme.colors.surface,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: paltaTheme.colors.border,
              }}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: '100%', height: 160, backgroundColor: paltaTheme.colors.surfaceMuted }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
                  <Text
                    style={{ flex: 1, fontSize: 18, fontWeight: '750', color: paltaTheme.colors.textPrimary }}
                  >
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: paltaTheme.colors.brand }}>
                    {contentKindLabel(item.contentKind)}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: paltaTheme.colors.textSecondary }}>
                  {itemSubtitle(item)}
                </Text>
                <Text style={{ fontSize: 13, color: paltaTheme.colors.textSecondary }}>
                  {itemMeta(item)}
                </Text>
                {item.experienceTags?.length ? (
                  <Text style={{ fontSize: 13, color: paltaTheme.colors.textSecondary }}>
                    {item.experienceTags.slice(0, 3).join(' · ')}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={Boolean(selectedItem)}
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable
          onPress={() => setSelectedItem(null)}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.22)' }}
        >
          <Pressable
            onPress={() => undefined}
            style={{
              borderTopLeftRadius: paltaTheme.radius.xl,
              borderTopRightRadius: paltaTheme.radius.xl,
              backgroundColor: paltaTheme.colors.surface,
              padding: paltaTheme.spacing.lg,
              gap: paltaTheme.spacing.md,
            }}
          >
            {selectedItem ? (
              <>
                <View style={{ gap: paltaTheme.spacing.xs }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: paltaTheme.colors.brand }}>
                    {contentKindLabel(selectedItem.contentKind)}
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: paltaTheme.colors.textPrimary }}>
                    {selectedItem.title}
                  </Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: paltaTheme.colors.textSecondary }}>
                    {itemSubtitle(selectedItem)}
                  </Text>
                  <Text style={{ fontSize: 13, color: paltaTheme.colors.textSecondary }}>
                    {itemMeta(selectedItem)}
                  </Text>
                </View>

                {selectedItem.primaryAction ? (
                  <PaltaButton
                    label={actionLabel(selectedItem)}
                    onPress={() => openExternal(selectedItem.primaryAction?.url)}
                  />
                ) : null}

                {businessIdFor(selectedItem) ? (
                  <PaltaButton
                    label="Ver negocio"
                    variant="secondary"
                    onPress={() => {
                      const businessId = businessIdFor(selectedItem);
                      if (!businessId) return;
                      setSelectedItem(null);
                      router.push(`/business/${encodeURIComponent(businessId)}`);
                    }}
                  />
                ) : null}

                <PaltaButton label="Cerrar" variant="ghost" onPress={() => setSelectedItem(null)} />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenFrame>
  );
}
