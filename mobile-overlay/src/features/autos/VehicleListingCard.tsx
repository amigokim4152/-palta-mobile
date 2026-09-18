import { Image, Pressable, Text, View } from 'react-native';
import type { VehicleListingView } from '../../../../src/autos/autosContracts';
import { paltaTheme } from '../../theme/paltaTheme';

function formatClp(value: number) {
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

function formatKm(value: number) {
  return `${new Intl.NumberFormat('es-CL').format(value)} km`;
}

const TRANSMISSION_LABEL = {
  automatic: 'Automático',
  manual: 'Manual',
} as const;

const FUEL_LABEL = {
  gasoline: 'Bencina',
  diesel: 'Diésel',
  hybrid: 'Híbrido',
  electric: 'Eléctrico',
} as const;

export function VehicleListingCard({
  item,
  onPress,
  saved = false,
  onToggleSaved,
}: {
  item: VehicleListingView;
  onPress: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
}) {
  const { vehicle, listing } = item;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        overflow: 'hidden',
        borderRadius: paltaTheme.radius.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
        backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
      })}
    >
      <View style={{ flexDirection: 'row' }}>
        <Image
          source={{ uri: listing.imageUrls[0] }}
          resizeMode="cover"
          style={{ width: 126, minHeight: 132, backgroundColor: paltaTheme.color.surfaceMuted }}
        />
        <View style={{ flex: 1, padding: paltaTheme.spacing.sm, gap: paltaTheme.spacing.xxs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 16, fontWeight: '900', color: paltaTheme.color.textPrimary }}
            >
              {listing.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar auto'}
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                onToggleSaved?.();
              }}
              style={{ minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 20, color: saved ? paltaTheme.color.brandPrimary : paltaTheme.color.textMuted }}>
                {saved ? '♥' : '♡'}
              </Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>
            {formatClp(listing.priceClp)}
          </Text>

          <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
            {vehicle.year} · {formatKm(listing.mileageKm)} · {TRANSMISSION_LABEL[vehicle.transmission]}
          </Text>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
            {FUEL_LABEL[vehicle.fuel]} · {listing.comuna}{listing.sector ? ` · ${listing.sector}` : ''}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 }}>
            <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.surfaceMuted }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: paltaTheme.color.textSecondary }}>
                {listing.sellerType === 'owner_direct' ? 'Dueño directo' : 'Automotora'}
              </Text>
            </View>
            {listing.verifiedSeller ? (
              <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.brandSoft }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>Verificado</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
