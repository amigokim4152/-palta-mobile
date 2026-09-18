import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { composePlayFeed } from '../../../../src/play/playFeedComposer';
import type { PlayDiscoveryItem, PlayThemeKey } from '../../../../src/play/playDiscovery';
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
  { key: 'free', label: 'Gratis' },
  { key: 'outdoor', label: 'Aire libre' },
  { key: 'birthday', label: 'Cumpleaños' },
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

const secondarySections = [
  'Comer y tomar algo',
  'Eventos y cultura',
  'Familia',
  'Viajes y estadías',
] as const;

function sourceLabel(item: PlayDiscoveryItem): string {
  if (item.sourceKind === 'municipal_event') return 'Municipal';
  if (item.sourceKind === 'public_program') return 'Público';
  if (item.sourceKind === 'business') return 'Negocio';
  return 'Lugar';
}

function openDiscoveryItem(item: PlayDiscoveryItem) {
  const businessId = item.businessProjection?.businessId ?? item.businessId;
  if (businessId) {
    router.push(`/business/${encodeURIComponent(businessId)}`);
    return;
  }
  router.push('/map');
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
          <Text allowFontScaling style={{ fontSize: 11, fontWeight: '700' }}>
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}

function HeroDiscoveryCard({ item }: { item: PlayDiscoveryItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openDiscoveryItem(item)}
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
            {sourceLabel(item)}
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

function DiscoveryCard({ item }: { item: PlayDiscoveryItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openDiscoveryItem(item)}
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
            {sourceLabel(item)}
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

function CardSection({
  theme,
  items,
  showMapAction = false,
}: {
  theme: PlayThemeKey;
  items: readonly PlayDiscoveryItem[];
  showMapAction?: boolean;
}) {
  const copy = sectionCopy[theme];
  const heroItem = items[0];
  const remainingItems = items.slice(1);

  return (
    <View style={{ gap: paltaTheme.spacing.md }}>
      <SectionHeading title={copy.title} subtitle={copy.subtitle} />
      {heroItem ? (
        <HeroDiscoveryCard item={heroItem} />
      ) : (
        <View style={{ padding: paltaTheme.spacing.lg, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.border, gap: 6 }}>
          <Text allowFontScaling style={{ fontWeight: '800' }}>
            Estamos conectando más panoramas de tu zona.
          </Text>
          <Text allowFontScaling style={{ color: paltaTheme.color.textSecondary }}>
            Mostraremos horario, comuna, costo, imagen y fuente cuando estén disponibles.
          </Text>
        </View>
      )}

      {remainingItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 18 }}>
          {remainingItems.map((item) => <DiscoveryCard key={item.id} item={item} />)}
        </ScrollView>
      ) : null}

      {showMapAction ? (
        <PaltaButton label="Ver cerca de mí en el mapa" variant="secondary" onPress={() => router.push('/map')} />
      ) : null}
    </View>
  );
}

function BirthdaySection({ items, onExplore }: { items: readonly PlayDiscoveryItem[]; onExplore: () => void }) {
  return (
    <View style={{ gap: paltaTheme.spacing.md }}>
      <SectionHeading
        title="Cumpleaños"
        subtitle="Piscina, indoor, aire libre y experiencias especiales cerca de ti."
      />

      <View
        style={{
          padding: paltaTheme.spacing.md,
          borderRadius: paltaTheme.radius.prominent,
          backgroundColor: paltaTheme.color.avocadoCream,
          gap: 12,
        }}
      >
        <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          ¿Preparando un cumpleaños?
        </Text>
        <Text allowFontScaling style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}>
          Edad, invitados, distancia, piscina, comida y tipo de experiencia en un solo lugar.
        </Text>
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
          {items.slice(0, 6).map((item) => <DiscoveryCard key={item.id} item={item} />)}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function PlayScreen() {
  const [selectedTheme, setSelectedTheme] = useState<PlayThemeKey>('today');
  const locality = __DEV__ ? 'Vitacura' : undefined;
  const sourceItems = __DEV__ ? playPreviewItems : [];

  const feed = useMemo(
    () => composePlayFeed({ items: sourceItems, locality, selectedTheme }),
    [locality, selectedTheme, sourceItems],
  );

  return (
    <ScreenFrame
      title="Panoramas"
      subtitle="Qué hacer hoy, cerca de ti"
      action={
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/map')}
          style={{
            minHeight: paltaTheme.touch.minimum,
            paddingHorizontal: 12,
            justifyContent: 'center',
            borderRadius: paltaTheme.radius.control,
            borderWidth: 1,
            borderColor: paltaTheme.color.border,
          }}
        >
          <Text allowFontScaling style={{ fontWeight: '800' }}>Mapa</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 30, paddingBottom: paltaTheme.spacing.xxl }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/search')}
          style={{
            minHeight: 58,
            paddingHorizontal: paltaTheme.spacing.md,
            paddingVertical: paltaTheme.spacing.sm,
            borderRadius: paltaTheme.radius.prominent,
            backgroundColor: paltaTheme.color.surfaceMuted,
            justifyContent: 'center',
            gap: 3,
          }}
        >
          <Text allowFontScaling style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
            {locality ? `${locality} · Santiago` : 'Tu zona'}
          </Text>
          <Text allowFontScaling style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
            ¿Qué quieres hacer hoy?
          </Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 18 }}>
          {themeOptions.map((option) => (
            <FilterChip
              key={option.key}
              label={option.label}
              selected={selectedTheme === option.key}
              onPress={() => setSelectedTheme(option.key)}
            />
          ))}
        </ScrollView>

        {__DEV__ ? (
          <Text allowFontScaling style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>
            Vista previa visual · los datos marcados como ejemplo no se publican en producción.
          </Text>
        ) : null}

        <CardSection theme="today" items={feed.todayPublic.items} showMapAction />

        {selectedTheme === 'birthday' ? (
          <BirthdaySection items={feed.birthday.items} onExplore={() => setSelectedTheme('birthday')} />
        ) : feed.selectedTheme ? (
          <CardSection theme={feed.selectedTheme.theme} items={feed.selectedTheme.items} />
        ) : null}

        {selectedTheme !== 'birthday' ? (
          <BirthdaySection items={feed.birthday.items} onExplore={() => setSelectedTheme('birthday')} />
        ) : null}

        {selectedTheme !== 'weekend' && feed.weekendPublic.items.length > 0 ? (
          <CardSection theme="weekend" items={feed.weekendPublic.items} />
        ) : null}

        <View style={{ gap: paltaTheme.spacing.md }}>
          <SectionHeading title="Explora más" subtitle="Más formas de salir sin llenar la primera pantalla de categorías." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {secondarySections.map((label) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                onPress={() => router.push('/search')}
                style={{
                  width: '48%',
                  minHeight: 92,
                  padding: paltaTheme.spacing.md,
                  borderRadius: paltaTheme.radius.surface,
                  borderWidth: 1,
                  borderColor: paltaTheme.color.border,
                  backgroundColor: paltaTheme.color.surface,
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Text allowFontScaling style={{ fontSize: 15, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  {label}
                </Text>
                <Text allowFontScaling style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
                  Ver opciones cerca de ti
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScreenFrame>
  );
}
