import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  isPublicPlayItem,
  selectPlayDiscoveryItems,
  type PlayDiscoveryItem,
  type PlayThemeKey,
} from '../../../../src/play/playDiscovery';
import { ScreenFrame } from '../../components/ScreenFrame';
import { FilterChip } from '../../components/common/FilterChip';
import { PaltaButton } from '../../components/common/PaltaButton';
import { SectionHeading } from '../../components/common/SectionHeading';
import { paltaTheme } from '../../theme/paltaTheme';
import { playPreviewItems } from './playPreviewData';

const themeOptions: ReadonlyArray<{
  key: PlayThemeKey;
  label: string;
}> = [
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
    subtitle: 'Primero, actividades públicas y municipales que sí puedes aprovechar hoy.',
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

function DiscoveryCard({ item }: { item: PlayDiscoveryItem }) {
  return (
    <View
      accessibilityRole="summary"
      style={{
        width: 278,
        minHeight: 184,
        padding: paltaTheme.spacing.md,
        borderRadius: paltaTheme.radius.prominent,
        backgroundColor: paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.border,
        gap: paltaTheme.spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: paltaTheme.spacing.sm,
        }}
      >
        <Text
          allowFontScaling
          style={{
            fontSize: 12,
            fontWeight: '800',
            color: paltaTheme.color.brandPrimary,
          }}
        >
          {sourceLabel(item)}
        </Text>
        {item.isFree ? (
          <Text
            allowFontScaling
            style={{
              fontSize: 12,
              fontWeight: '800',
              color: paltaTheme.color.brandPrimary,
            }}
          >
            Gratis
          </Text>
        ) : null}
      </View>

      <Text
        allowFontScaling
        style={{
          fontSize: 19,
          fontWeight: '800',
          color: paltaTheme.color.textPrimary,
        }}
      >
        {item.title}
      </Text>

      <View style={{ gap: 4 }}>
        <Text
          allowFontScaling
          style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}
        >
          {item.comuna}{item.venue ? ` · ${item.venue}` : ''}
        </Text>
        <Text
          allowFontScaling
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: paltaTheme.color.textPrimary,
          }}
        >
          {item.scheduleLabel}
        </Text>
        {item.audienceLabel ? (
          <Text
            allowFontScaling
            style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}
          >
            {item.audienceLabel}
            {item.registrationRequired ? ' · Requiere inscripción' : ''}
          </Text>
        ) : null}
      </View>

      <Text
        allowFontScaling
        numberOfLines={1}
        style={{
          marginTop: 'auto',
          fontSize: 11,
          color: paltaTheme.color.textMuted,
        }}
      >
        {item.source.authority}
      </Text>
    </View>
  );
}

function BirthdaySpotlight({ onExplore }: { onExplore: () => void }) {
  return (
    <View
      style={{
        padding: paltaTheme.spacing.lg,
        borderRadius: paltaTheme.radius.prominent,
        backgroundColor: paltaTheme.color.avocadoCream,
        gap: paltaTheme.spacing.md,
      }}
    >
      <View style={{ gap: 6 }}>
        <Text
          allowFontScaling
          style={{
            fontSize: 12,
            fontWeight: '800',
            color: paltaTheme.color.textSecondary,
          }}
        >
          MOMENTOS ESPECIALES
        </Text>
        <Text
          allowFontScaling
          style={{
            fontSize: 21,
            fontWeight: '800',
            color: paltaTheme.color.textPrimary,
          }}
        >
          ¿Preparando un cumpleaños?
        </Text>
        <Text
          allowFontScaling
          style={{ fontSize: 14, color: paltaTheme.color.textSecondary }}
        >
          Busca por edad, cantidad de invitados, distancia y tipo de experiencia.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['Piscina', 'Indoor', 'Aire libre', 'Karting', 'Granja'].map((label) => (
          <View
            key={label}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: paltaTheme.radius.pill,
              backgroundColor: paltaTheme.color.surface,
            }}
          >
            <Text allowFontScaling style={{ fontSize: 12, fontWeight: '700' }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <PaltaButton label="Explorar cumpleaños" onPress={onExplore} />
    </View>
  );
}

export function PlayScreen() {
  const [selectedTheme, setSelectedTheme] = useState<PlayThemeKey>('today');
  const locality = __DEV__ ? 'Vitacura' : undefined;
  const sourceItems = __DEV__ ? playPreviewItems : [];

  const visibleItems = useMemo(
    () =>
      selectPlayDiscoveryItems(sourceItems, {
        locality,
        selectedTheme,
      }),
    [locality, selectedTheme, sourceItems],
  );

  const publicItems = useMemo(
    () => visibleItems.filter(isPublicPlayItem),
    [visibleItems],
  );

  const displayedItems =
    selectedTheme === 'birthday' ? visibleItems : publicItems.length > 0 ? publicItems : visibleItems;
  const copy = sectionCopy[selectedTheme];

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
          <Text allowFontScaling style={{ fontWeight: '800' }}>
            Mapa
          </Text>
        </Pressable>
      }
    >
      <View style={{ gap: 28, paddingBottom: paltaTheme.spacing.xxl }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/search')}
          style={{
            minHeight: paltaTheme.touch.minimum,
            paddingHorizontal: paltaTheme.spacing.md,
            paddingVertical: paltaTheme.spacing.sm,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: paltaTheme.color.surfaceMuted,
            justifyContent: 'center',
            gap: 3,
          }}
        >
          <Text
            allowFontScaling
            style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}
          >
            {locality ? `${locality} · Santiago` : 'Tu zona'}
          </Text>
          <Text
            allowFontScaling
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: paltaTheme.color.textPrimary,
            }}
          >
            ¿Qué quieres hacer?
          </Text>
        </Pressable>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <SectionHeading
            title="Elige por momento"
            subtitle="No necesitas saber quién organiza el panorama. Elige qué quieres hacer."
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {themeOptions.map((option) => (
              <FilterChip
                key={option.key}
                label={option.label}
                selected={selectedTheme === option.key}
                onPress={() => setSelectedTheme(option.key)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: paltaTheme.spacing.md }}>
          <View style={{ gap: 6 }}>
            <SectionHeading title={copy.title} subtitle={copy.subtitle} />
            {__DEV__ ? (
              <Text
                allowFontScaling
                style={{ fontSize: 11, color: paltaTheme.color.textMuted }}
              >
                Vista previa de estructura · datos de ejemplo hasta conectar agendas oficiales.
              </Text>
            ) : null}
          </View>

          {displayedItems.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 18 }}
            >
              {displayedItems.map((item) => (
                <DiscoveryCard key={item.id} item={item} />
              ))}
            </ScrollView>
          ) : (
            <View
              style={{
                padding: paltaTheme.spacing.lg,
                borderRadius: paltaTheme.radius.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.border,
                gap: 6,
              }}
            >
              <Text allowFontScaling style={{ fontWeight: '800' }}>
                Estamos conectando las agendas oficiales de tu zona.
              </Text>
              <Text
                allowFontScaling
                style={{ color: paltaTheme.color.textSecondary }}
              >
                Aquí aparecerán actividades vigentes, con horario, comuna, costo y fuente.
              </Text>
            </View>
          )}

          <PaltaButton
            label="Ver en mapa"
            variant="secondary"
            onPress={() => router.push('/map')}
          />
        </View>

        <BirthdaySpotlight onExplore={() => setSelectedTheme('birthday')} />

        <View style={{ gap: paltaTheme.spacing.md }}>
          <SectionHeading
            title="También puedes explorar"
            subtitle="Más opciones sin cargar la primera pantalla con demasiadas categorías."
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {secondarySections.map((label) => (
              <View
                key={label}
                style={{
                  width: '48%',
                  minHeight: 82,
                  padding: paltaTheme.spacing.md,
                  borderRadius: paltaTheme.radius.surface,
                  borderWidth: 1,
                  borderColor: paltaTheme.color.border,
                  backgroundColor: paltaTheme.color.surface,
                  justifyContent: 'center',
                }}
              >
                <Text
                  allowFontScaling
                  style={{
                    fontSize: 15,
                    fontWeight: '800',
                    color: paltaTheme.color.textPrimary,
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScreenFrame>
  );
}
