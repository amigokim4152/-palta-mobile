import { Image, Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../theme/paltaTheme';

type Props = {
  name: string;
  meta: string;
  distance?: string;
  imageUrl?: string;
  serviceLabels?: readonly string[];
  highlight?: string;
  selected?: boolean;
  onPress?: () => void;
};

const categoryLabels: Record<string, string> = {
  auto_repair: 'Taller mecánico',
  pharmacy: 'Farmacia',
  restaurant: 'Restaurante',
  cafe: 'Café',
  bakery: 'Panadería',
  beauty: 'Belleza',
  home_repair: 'Hogar y reparación',
  pet: 'Mascotas',
  education: 'Clases y educación',
  professional_service: 'Servicios profesionales',
};

function firstLetter(value: string) {
  return value.trim().charAt(0).toUpperCase() || 'P';
}

function consumerMetaLabel(value: string): string | undefined {
  const known = categoryLabels[value];
  if (known) return known;
  // Never leak raw internal taxonomy keys such as AUTO_MOTO_MOBILITY.
  if (value.includes('_')) return undefined;
  return value;
}

export function LocalResultCard({
  name,
  meta,
  distance,
  imageUrl,
  serviceLabels = [],
  highlight,
  selected = false,
  onPress,
}: Props) {
  const [status, ...rawSecondaryMeta] = meta
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean);
  const secondaryMeta = rawSecondaryMeta
    .map(consumerMetaLabel)
    .filter((value): value is string => Boolean(value));
  const verified = secondaryMeta.includes('Verificado');
  const descriptiveMeta = secondaryMeta.filter((value) => value !== 'Verificado');
  const labels = serviceLabels.filter(Boolean).slice(0, 2);
  const isOpenNow = status === 'Abierto ahora';
  // Verification has its own compact trust cue. Keep the single highlight slot
  // for a real current reason such as a benefit or fresh update.
  const usefulHighlight = highlight === 'Negocio verificado' ? undefined : highlight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 112,
        paddingHorizontal: selected ? paltaTheme.spacing.sm : 0,
        paddingVertical: paltaTheme.spacing.sm,
        borderBottomWidth: selected ? 0 : 1,
        borderWidth: selected ? 1 : 0,
        borderColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
        borderRadius: selected ? paltaTheme.radius.surface : 0,
        backgroundColor: selected
          ? paltaTheme.color.brandSoft
          : pressed
            ? paltaTheme.color.surfaceMuted
            : paltaTheme.color.surface,
      })}
    >
      <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            accessibilityLabel={`Foto de ${name}`}
            resizeMode="cover"
            style={{
              width: 88,
              height: 88,
              borderRadius: paltaTheme.radius.control,
              backgroundColor: paltaTheme.color.surfaceMuted,
            }}
          />
        ) : (
          <View
            accessibilityElementsHidden
            style={{
              width: 88,
              height: 88,
              borderRadius: paltaTheme.radius.control,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected
                ? paltaTheme.color.surface
                : paltaTheme.color.brandSoft,
            }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: '800',
                color: paltaTheme.color.brandPrimary,
              }}
            >
              {firstLetter(name)}
            </Text>
          </View>
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: paltaTheme.spacing.xs,
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                fontSize: 17,
                fontWeight: '800',
                color: paltaTheme.color.textPrimary,
              }}
            >
              {name}
            </Text>
            {distance ? (
              <Text
                numberOfLines={1}
                style={{
                  color: paltaTheme.color.textMuted,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {distance}
              </Text>
            ) : null}
          </View>

          {(status || verified) ? (
            <View
              style={{
                marginTop: paltaTheme.spacing.xxs,
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {status ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: isOpenNow
                      ? paltaTheme.color.brandPrimary
                      : paltaTheme.color.textSecondary,
                    fontWeight: isOpenNow ? '800' : '600',
                    fontSize: 13,
                  }}
                >
                  {status}
                </Text>
              ) : null}
              {verified ? (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                    borderRadius: paltaTheme.radius.pill,
                    backgroundColor: paltaTheme.color.brandSoft,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: paltaTheme.color.brandPrimary,
                      fontSize: 11,
                      fontWeight: '800',
                    }}
                  >
                    ✓ Verificado
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {labels.length ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: paltaTheme.spacing.xxs,
                color: paltaTheme.color.textSecondary,
                fontSize: 13,
              }}
            >
              {labels.join(' · ')}
            </Text>
          ) : descriptiveMeta.length ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: paltaTheme.spacing.xxs,
                color: paltaTheme.color.textSecondary,
                fontSize: 13,
              }}
            >
              {descriptiveMeta.join(' · ')}
            </Text>
          ) : null}

          {usefulHighlight ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: paltaTheme.spacing.xs,
                maxWidth: '100%',
                borderRadius: paltaTheme.radius.pill,
                paddingHorizontal: paltaTheme.spacing.xs,
                paddingVertical: paltaTheme.spacing.xxs,
                backgroundColor: paltaTheme.color.brandSoft,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: paltaTheme.color.textPrimary,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {usefulHighlight}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
