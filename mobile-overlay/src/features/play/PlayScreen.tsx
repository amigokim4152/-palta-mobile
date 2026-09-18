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

const PANORAMA_LABEL = 'Panorama';

type PanoramaIntentKey = PlayThemeKey | 'nearby' | 'culture' | 'food';
type PanoramaContentKey = PlayContentKind | 'library';

/**
 * runtime-composition-v1 currently owns the baseline Play Core and overlays only
 * this screen. Keep new intents locally compatible until the Core contract is
 * promoted into composition; the feature branch Core already contains them.
 */
const compositionThemeKeys: readonly PlayThemeKey[] = [
  'today',
  'weekend',
  'family',
  'couple',
  'free',
  'outdoor',
  'birthday',
];

const cultureContentKinds = new Set([
  'movie',
  'live_performance',
  'concert',
  'theater',
  'comedy',
  'exhibition',
  'museum',
  'library',
  'festival',
  'workshop',
]);

const themeOptions: ReadonlyArray<{ key: PanoramaIntentKey; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: 'nearby', label: 'Cerca de mí' },
  { key: 'free', label: 'Gratis' },
  { key: 'family', label: 'Con niños' },
  { key: 'weekend', label: 'Este finde' },
  { key: 'culture', label: 'Cultura' },
  { key: 'food', label: 'Comer' },
  { key: 'outdoor', label: 'Aire libre' },
  { key: 'couple', label: 'En pareja' },
  { key: 'birthday', label: 'Cumpleaños' },
];

const contentOptions: ReadonlyArray<{ key: PanoramaContentKey; label: string }> = [
  { key: 'movie', label: 'Cine' },
  { key: 'theater', label: 'Teatro' },
  { key: 'concert', label: 'Conciertos' },
  { key: 'exhibition', label: 'Exposiciones' },
  { key: 'museum', label: 'Museos' },
  { key: 'library', label: 'Bibliotecas' },
  { key: 'sports_event', label: 'Deportes' },
  { key: 'park', label: 'Parques' },
  { key: 'active_leisure', label: 'Actividades' },
  { key: 'food_outing', label: 'Comer' },
  { key: 'festival', label: 'Festivales' },
  { key: 'day_trip', label: 'Escapadas' },
];

const sectionCopy: Record<PanoramaIntentKey, { title: string; subtitle: string }> = {
  today: {
    title: 'Hoy cerca de ti',
    subtitle: 'Actividades públicas y municipales que puedes aprovechar hoy.',
  },
  nearby: {
    title: 'Cerca de ti',
    subtitle: 'Opciones de tu comuna o con distancia y tiempo de viaje ya resueltos.',
  },
  free: {
    title: 'Gratis cerca de ti',
    subtitle: 'Panoramas públicos y otras opciones sin costo.',
  },
  family: {
    title: 'Para hacer con niños',
    subtitle: 'Actividades y lugares pensados para compartir en familia.',
  },
  weekend: {
    title: 'Este fin de semana',
    subtitle: 'Planes cercanos ordenados por momento, zona y utilidad.',
  },
  culture: {
    title: 'Cultura',
    subtitle: 'Teatro, música, cine, exposiciones, museos y bibliotecas cerca de ti.',
  },
  food: {
    title: 'Comer también es panorama',
    subtitle: 'Gastronomía y salidas para comer como parte de tu plan.',
  },
  couple: {
    title: 'Para salir en pareja',
    subtitle: 'Cine, cultura, comida y otros panoramas para compartir de a dos.',
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

const kindSubtitle: Partial<Record<PanoramaContentKey, string>> = {
  movie: 'Cartelera, horarios y cines cercanos en un solo lugar.',
  theater: 'Teatro, salas pequeñas y obras cerca de ti.',
  concert: 'Música en vivo y conciertos para hoy o los próximos días.',
  exhibition: 'Exposiciones, galerías y cultura para visitar hoy o esta semana.',
  museum: 'Museos y colecciones con información útil para planificar la visita.',
  library: 'Bibliotecas públicas y actividades culturales de tu zona.',
  sports_event: 'Partidos, campeonatos y actividades deportivas de tu zona.',
  park: 'Parques, plazas y espacios para salir sin complicarte.',
  active_leisure: 'Karting, bowling, trampolines, escalada y otras experiencias.',
  festival: 'Festivales y celebraciones locales, incluidas las de temporada.',
  day_trip: 'Ideas para salir de la rutina sin perder de vista la distancia.',
  food_outing: 'Lugares para comer o tomar algo como parte del panorama.',
};

function isCompositionTheme(theme: PanoramaIntentKey): theme is PlayThemeKey {
  return (compositionThemeKeys as readonly string[]).includes(theme);
}

function isNearby(item: PlayDiscoveryItem, locality?: string): boolean {
  if (locality && item.comuna === locality) return true;
  if (item.travelTimeMinutes !== undefined && item.travelTimeMinutes <= 30) return true;
  if (item.distanceM !== undefined && item.distanceM <= 10_000) return true;
  return false;
}

function matchesPanoramaIntent(
  item: PlayDiscoveryItem,
  intent: Exclude<PanoramaIntentKey, PlayThemeKey> | 'nearby' | 'culture' | 'food',
  locality?: string,
): boolean {
  if (intent === 'nearby') return isNearby(item, locality);
  if (intent === 'culture') return cultureContentKinds.has(String(item.contentKind));
  if (intent === 'food') return String(item.contentKind) === 'food_outing';
  return false;
}

function selectPanoramaIntentItems(
  items: readonly PlayDiscoveryItem[],
  intent: PanoramaIntentKey,
  locality?: string,
): PlayDiscoveryItem[] {
  if (isCompositionTheme(intent)) {
    return selectPlayDiscoveryItems(items, {
      ...(locality ? { locality } : {}),
      selectedTheme: intent,
    });
  }
  return selectPlayDiscoveryItems(items, locality ? { locality } : {})
    .filter((item) => matchesPanoramaIntent(item, intent, locality));
}

function contentKindLabel(kind: PlayDiscoveryItem['contentKind'] | PanoramaContentKey): string {
  if (String(kind) === 'library') return 'Bibliotecas';
  return playContentDefinition(kind as PlayContentKind).labelEs;
}

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

function ExperienceTags({ item }: { item: PlayDiscoveryItem }) {
  if (!item.experienceTags?.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {item.experienceTags.slice(0, 3).map((tag) => (
        <View
          key={tag}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: paltaTheme.radius.pill,
            backgroundColor: paltaTheme.color.surfaceMuted,
          }}
        >
          <Text allowFontScaling style={{ fontSize: 11, fontWeight: '700' }}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

function HeroDiscoveryCard({ item, onPress }: { item: PlayDiscoveryItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        overflow: 'hidden',
        borderRadius: paltaTheme.radius.prominent,
        backgroundColor: paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.border,
      }}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          resizeMode="cover"
          style={{ width: '100%', height: 190, backgroundColor: paltaTheme.color.surfaceMuted }}
        />
      ) : (
        <View style={{ height: 150, backgroundColor: paltaTheme.color.avocadoCream }} />
      )}
      <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text allowFontScaling style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
            {sourceLabel(item)} · {contentKindLabel(item.contentKind)}
          </Text>
          <Text allowFontScaling style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
            {item.isFree ? 'Gratis' : item.priceLabel ?? item.distanceLabel ?? ''}
          </Text>
        </View>
        <Text allowFontScaling style={{ fontSize: 22, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          {item.title}
        </Text>
        <Text allowFontScaling style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}>
          {item.comuna}{item.venue ? ` · ${item.venue}` : ''}{item.distanceLabel ? ` · ${item.distanceLabel}` : ''}
        </Text>
        <Text allowFontScaling style={{ fontSize: 14, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          {item.scheduleLabel}
        </Text>
        <ExperienceTags item={item} />
        <Text allowFontScaling numberOfLines={1} style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>
          {item.source.authority}
        </Text>
      </View>
    </Pressable>
  );
}

function DiscoveryCard({ item, onPress }: { item: PlayDiscoveryItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        width: 278,
        overflow: 'hidden',
        borderRadius: paltaTheme.radius.prominent,
        backgroundColor: paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.border,
      }}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          resizeMode="cover"
          style={{ width: '100%', height: 142, backgroundColor: paltaTheme.color.surfaceMuted }}
        />
      ) : (
        <View style={{ height: 110, backgroundColor: paltaTheme.color.avocadoCream }} />
      )}
      <View style={{ padding: paltaTheme.spacing.md, gap: 8, minHeight: 180 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text allowFontScaling style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
            {sourceLabel(item)} · {contentKindLabel(item.contentKind)}
          </Text>
          {item.isFree || item.priceLabel ? (
            <Text allowFontScaling style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
              {item.isFree ? 'Gratis' : item.priceLabel}
            </Text>
          ) : null}
        </View>
        <Text allowFontScaling numberOfLines={2} style={{ fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          {item.title}
        </Text>
        <Text allowFontScaling style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>
          {item.comuna}{item.distanceLabel ? ` · ${item.distanceLabel}` : ''}
        </Text>
        <Text allowFontScaling style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.textPrimary }}>
          {item.scheduleLabel}
        </Text>
        {item.audienceLabel ? (
          <Text allowFontScaling numberOfLines={1} style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
            {item.audienceLabel}{item.registrationRequired ? ' · Requiere inscripción' : ''}
          </Text>
        ) : null}
        <ExperienceTags item={item} />
      </View>
    </Pressable>
  );
}

function DiscoveryDetail({ item, onClose }: { item: PlayDiscoveryItem | null; onClose: () => void }) {
  const sourceUrl = item?.source.sourceUrl;
  const primaryAction = item?.primaryAction;
  return (
    <Modal visible={Boolean(item)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' }}>
        <View
          style={{
            maxHeight: '86%',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: paltaTheme.color.surface,
            overflow: 'hidden',
          }}
        >
          {item ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} resizeMode="cover" style={{ width: '100%', height: 220 }} /> : null}
              <View style={{ padding: paltaTheme.spacing.lg, gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <Text allowFontScaling style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
                    {sourceLabel(item)} · {contentKindLabel(item.contentKind)}{item.isFree ? ' · Gratis' : ''}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Text allowFontScaling style={{ fontSize: 20 }}>×</Text>
                  </Pressable>
                </View>
                <Text allowFontScaling style={{ fontSize: 24, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{item.title}</Text>
                <Text allowFontScaling style={{ fontSize: 15, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{item.scheduleLabel}</Text>
                <Text allowFontScaling style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}>
                  {item.comuna}{item.venue ? ` · ${item.venue}` : ''}{item.distanceLabel ? ` · ${item.distanceLabel}` : ''}
                </Text>
                {item.audienceLabel ? <Text allowFontScaling style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}>{item.audienceLabel}</Text> : null}
                {item.registrationRequired ? (
                  <View style={{ padding: 12, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surfaceMuted }}>
                    <Text allowFontScaling style={{ fontSize: 13, fontWeight: '700' }}>Requiere inscripción. Revisa la fuente oficial antes de ir.</Text>
                  </View>
                ) : null}
                <ExperienceTags item={item} />
                <View style={{ paddingTop: 6, gap: 4 }}>
                  <Text allowFontScaling style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>Fuente</Text>
                  <Text allowFontScaling style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{item.source.authority}</Text>
                  {item.source.verifiedAt ? <Text allowFontScaling style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>Verificado: {item.source.verifiedAt}</Text> : null}
                </View>
                {primaryAction ? (
                  <PaltaButton
                    label={primaryAction.label ?? (primaryAction.kind === 'ticket' ? 'Ver entradas' : primaryAction.kind === 'registration' ? 'Inscribirme' : 'Reservar')}
                    onPress={() => void Linking.openURL(primaryAction.url)}
                  />
                ) : null}
                <PaltaButton label="Ver en mapa" variant="secondary" onPress={() => { onClose(); router.push('/map'); }} />
                {sourceUrl && sourceUrl !== primaryAction?.url ? (
                  <PaltaButton label="Ver fuente oficial" variant={primaryAction ? 'secondary' : 'primary'} onPress={() => void Linking.openURL(sourceUrl)} />
                ) : null}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function CardSection({
  theme,
  items,
  onOpenItem,
  showMapAction = false,
}: {
  theme: PanoramaIntentKey;
  items: readonly PlayDiscoveryItem[];
  onOpenItem: (item: PlayDiscoveryItem) => void;
  showMapAction?: boolean;
}) {
  const copy = sectionCopy[theme];
  const heroItem = items[0];
  const remainingItems = items.slice(1);
  return (
    <View style={{ gap: paltaTheme.spacing.md }}>
      <SectionHeading title={copy.title} subtitle={copy.subtitle} />
      {heroItem ? (
        <HeroDiscoveryCard item={heroItem} onPress={() => onOpenItem(heroItem)} />
      ) : (
        <View style={{ padding: paltaTheme.spacing.lg, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.border, gap: 6 }}>
          <Text allowFontScaling style={{ fontWeight: '800' }}>Estamos conectando más panoramas de tu zona.</Text>
          <Text allowFontScaling style={{ color: paltaTheme.color.textSecondary }}>Mostraremos horario, comuna, costo, imagen y fuente cuando estén disponibles.</Text>
        </View>
      )}
      {remainingItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 18 }}>
          {remainingItems.map((item) => <DiscoveryCard key={item.id} item={item} onPress={() => onOpenItem(item)} />)}
        </ScrollView>
      ) : null}
      {showMapAction ? <PaltaButton label="Ver cerca de mí en el mapa" variant="secondary" onPress={() => router.push('/map')} /> : null}
    </View>
  );
}

function ContentKindSection({ kind, items, onOpenItem }: { kind: PanoramaContentKey; items: readonly PlayDiscoveryItem[]; onOpenItem: (item: PlayDiscoveryItem) => void }) {
  const label = kind === 'library' ? 'Bibliotecas' : playContentDefinition(kind as PlayContentKind).labelEs;
  const heroItem = items[0];
  const remainingItems = items.slice(1);
  return (
    <View style={{ gap: paltaTheme.spacing.md }}>
      <SectionHeading title={label} subtitle={kindSubtitle[kind] ?? 'Opciones cercanas ordenadas por zona, distancia y momento.'} />
      {heroItem ? <HeroDiscoveryCard item={heroItem} onPress={() => onOpenItem(heroItem)} /> : (
        <View style={{ padding: paltaTheme.spacing.lg, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.border, gap: 6 }}>
          <Text allowFontScaling style={{ fontWeight: '800' }}>Estamos conectando esta categoría en tu zona.</Text>
          <Text allowFontScaling style={{ color: paltaTheme.color.textSecondary }}>Cuando haya datos, verás horarios, distancia, precio y forma de reservar o comprar.</Text>
        </View>
      )}
      {remainingItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 18 }}>
          {remainingItems.map((item) => <DiscoveryCard key={item.id} item={item} onPress={() => onOpenItem(item)} />)}
        </ScrollView>
      ) : null}
    </View>
  );
}

function BirthdaySection({ items, onExplore, onOpenItem }: { items: readonly PlayDiscoveryItem[]; onExplore: () => void; onOpenItem: (item: PlayDiscoveryItem) => void }) {
  return (
    <View style={{ gap: paltaTheme.spacing.md }}>
      <SectionHeading title="Cumpleaños" subtitle="Piscina, indoor, aire libre y experiencias especiales cerca de ti." />
      <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.prominent, backgroundColor: paltaTheme.color.avocadoCream, gap: 12 }}>
        <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800', color: paltaTheme.color.textPrimary }}>¿Preparando un cumpleaños?</Text>
        <Text allowFontScaling style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}>Edad, invitados, distancia, piscina, comida y tipo de experiencia en un solo lugar.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['Piscina', 'Indoor', 'Aire libre', 'Karting', 'Granja'].map((label) => (
            <View key={label} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.surface }}>
              <Text allowFontScaling style={{ fontSize: 12, fontWeight: '700' }}>{label}</Text>
            </View>
          ))}
        </View>
        <PaltaButton label="Explorar cumpleaños" onPress={onExplore} />
      </View>
      {items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 18 }}>
          {items.slice(0, 6).map((item) => <DiscoveryCard key={item.id} item={item} onPress={() => onOpenItem(item)} />)}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function PlayScreen() {
  const [selectedIntent, setSelectedIntent] = useState<PanoramaIntentKey>('today');
  const [selectedKind, setSelectedKind] = useState<PanoramaContentKey | null>(null);
  const [selectedDiscoveryItem, setSelectedDiscoveryItem] = useState<PlayDiscoveryItem | null>(null);
  const locality = __DEV__ ? 'Vitacura' : undefined;
  const sourceItems = __DEV__ ? playPreviewItems : [];
  const baseTheme: PlayThemeKey = isCompositionTheme(selectedIntent) ? selectedIntent : 'today';

  const feed = useMemo(
    () => composePlayFeed({ items: sourceItems, ...(locality ? { locality } : {}), selectedTheme: baseTheme }),
    [baseTheme, locality, sourceItems],
  );

  const selectedIntentItems = useMemo(
    () => selectPanoramaIntentItems(sourceItems, selectedIntent, locality).slice(0, 12),
    [locality, selectedIntent, sourceItems],
  );

  const selectedKindItems = useMemo(() => {
    if (!selectedKind) return [];
    return selectPlayDiscoveryItems(
      sourceItems.filter((item) => String(item.contentKind) === selectedKind),
      locality ? { locality } : {},
    ).slice(0, 12);
  }, [locality, selectedKind, sourceItems]);

  function chooseIntent(intent: PanoramaIntentKey) {
    setSelectedKind(null);
    setSelectedIntent(intent);
  }

  function chooseKind(kind: PanoramaContentKey) {
    setSelectedKind((current) => current === kind ? null : kind);
  }

  function openItem(item: PlayDiscoveryItem) {
    const businessId = businessIdFor(item);
    if (businessId) {
      router.push(`/business/${encodeURIComponent(businessId)}`);
      return;
    }
    setSelectedDiscoveryItem(item);
  }

  return (
    <ScreenFrame
      title={PANORAMA_LABEL}
      subtitle="Qué hacer hoy, cerca de ti"
      action={
        <Pressable accessibilityRole="button" onPress={() => router.push('/map')} style={{ minHeight: paltaTheme.touch.minimum, paddingHorizontal: 12, justifyContent: 'center', borderRadius: paltaTheme.radius.control, borderWidth: 1, borderColor: paltaTheme.color.border }}>
          <Text allowFontScaling style={{ fontWeight: '800' }}>Mapa</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 30, paddingBottom: paltaTheme.spacing.xxl }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/search')} style={{ minHeight: 58, paddingHorizontal: paltaTheme.spacing.md, paddingVertical: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.prominent, backgroundColor: paltaTheme.color.surfaceMuted, justifyContent: 'center', gap: 3 }}>
          <Text allowFontScaling style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>{locality ? `${locality} · Santiago` : 'Tu zona'}</Text>
          <Text allowFontScaling style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>¿Qué quieres hacer hoy?</Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 18 }}>
          {themeOptions.map((option) => <FilterChip key={option.key} label={option.label} selected={!selectedKind && selectedIntent === option.key} onPress={() => chooseIntent(option.key)} />)}
        </ScrollView>

        {__DEV__ ? <Text allowFontScaling style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>Vista previa visual · los datos marcados como ejemplo no se publican en producción.</Text> : null}

        <CardSection theme="today" items={feed.todayPublic.items} onOpenItem={openItem} showMapAction />

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <SectionHeading title="¿Qué te gustaría hacer?" subtitle="Elige el tipo de panorama; priorizamos zona, fecha y tus intereses explícitos, nunca la comisión." />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 18 }}>
            {contentOptions.map((option) => (
              <FilterChip key={option.key} label={option.label} selected={selectedKind === option.key} onPress={() => chooseKind(option.key)} />
            ))}
          </ScrollView>
        </View>

        {selectedKind ? <ContentKindSection kind={selectedKind} items={selectedKindItems} onOpenItem={openItem} /> : null}

        {!selectedKind && selectedIntent === 'birthday' ? (
          <BirthdaySection items={feed.birthday.items} onExplore={() => chooseIntent('birthday')} onOpenItem={openItem} />
        ) : !selectedKind && selectedIntent !== 'today' ? (
          <CardSection
            theme={selectedIntent}
            items={selectedIntentItems}
            onOpenItem={openItem}
            showMapAction={selectedIntent === 'nearby'}
          />
        ) : null}

        {selectedIntent !== 'birthday' ? <BirthdaySection items={feed.birthday.items} onExplore={() => chooseIntent('birthday')} onOpenItem={openItem} /> : null}
        {selectedIntent !== 'weekend' && feed.weekendPublic.items.length > 0 ? <CardSection theme="weekend" items={feed.weekendPublic.items} onOpenItem={openItem} /> : null}

        <View style={{ gap: paltaTheme.spacing.md }}>
          <SectionHeading title="Más panoramas" subtitle="Museos, bibliotecas, ferias, naturaleza, granjas, tours, estadías y más se incorporan con la misma lógica local." />
          <PaltaButton label="Ver todo" variant="secondary" onPress={() => router.push('/search')} />
        </View>
      </View>

      <DiscoveryDetail item={selectedDiscoveryItem} onClose={() => setSelectedDiscoveryItem(null)} />
    </ScreenFrame>
  );
}
