import { router, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { findAutosDemoListing } from './autosDemoData';
import { toggleAutosListingSaved, useAutosDemoState } from './autosDemoState';

function formatClp(value: number) {
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

function formatKm(value: number) {
  return `${new Intl.NumberFormat('es-CL').format(value)} km`;
}

const TRANSMISSION_LABEL = { automatic: 'Automático', manual: 'Manual' } as const;
const FUEL_LABEL = { gasoline: 'Bencina', diesel: 'Diésel', hybrid: 'Híbrido', electric: 'Eléctrico' } as const;
const BODY_LABEL = { suv: 'SUV', sedan: 'Sedán', hatchback: 'Hatchback', pickup: 'Pickup', van: 'Van', coupe: 'Coupé' } as const;

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexBasis: '47%', gap: 2 }}>
      <Text style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{value}</Text>
    </View>
  );
}

export function VehicleListingDetailScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const demoState = useAutosDemoState();
  const item =
    demoState.publishedListings.find((candidate) => candidate.listing.id === listingId) ??
    findAutosDemoListing(listingId);

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: paltaTheme.spacing.xl, backgroundColor: paltaTheme.color.canvas }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Publicación no disponible</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: paltaTheme.spacing.md }}>
          <Text style={{ fontWeight: '800', color: paltaTheme.color.brandPrimary }}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { vehicle, listing } = item;
  const saved = demoState.savedListingIds.includes(listing.id);
  const publisherBusinessId = listing.publisherBusinessId;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: listing.imageUrls[0] }} resizeMode="cover" style={{ width: '100%', height: 280, backgroundColor: paltaTheme.color.surfaceMuted }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{ position: 'absolute', top: paltaTheme.spacing.sm, left: paltaTheme.spacing.sm, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.surface }}
          >
            <Text style={{ fontSize: 22, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.lg }}>
          <View style={{ gap: paltaTheme.spacing.xxs }}>
            <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{listing.title}</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>{formatClp(listing.priceClp)}</Text>
            <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>{listing.comuna}{listing.sector ? ` · ${listing.sector}` : ''}</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.md, padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface }}>
            <Spec label="Año" value={String(vehicle.year)} />
            <Spec label="Kilometraje" value={formatKm(listing.mileageKm)} />
            <Spec label="Transmisión" value={TRANSMISSION_LABEL[vehicle.transmission]} />
            <Spec label="Combustible" value={FUEL_LABEL[vehicle.fuel]} />
            <Spec label="Carrocería" value={BODY_LABEL[vehicle.bodyType]} />
            <Spec label="Versión" value={vehicle.version ?? '—'} />
          </View>

          <View style={{ gap: paltaTheme.spacing.sm }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Lo destacado</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
              {listing.highlights.map((highlight) => (
                <View key={highlight} style={{ paddingHorizontal: paltaTheme.spacing.sm, paddingVertical: 7, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.brandSoft }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>{highlight}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ gap: paltaTheme.spacing.xs }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Descripción</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: paltaTheme.color.textSecondary }}>{listing.description}</Text>
          </View>

          <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface, gap: 5 }}>
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>Vendedor</Text>
            <Text style={{ fontSize: 16, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
              {listing.sellerType === 'owner_direct' ? 'Dueño directo' : 'Automotora'}
            </Text>
            <Text style={{ fontSize: 12, color: listing.verifiedSeller ? paltaTheme.color.brandPrimary : paltaTheme.color.textMuted }}>
              {listing.verifiedSeller ? 'Identidad del vendedor verificada · demo' : 'Verificación pendiente · demo'}
            </Text>
            {publisherBusinessId ? (
              <Pressable
                onPress={() =>
                  router.push(
                    publisherBusinessId.startsWith('demo-business-auto-')
                      ? `/autos/dealer/${encodeURIComponent(publisherBusinessId)}`
                      : `/business/${encodeURIComponent(publisherBusinessId)}`,
                  )
                }
                style={{ marginTop: 6 }}
              >
                <Text style={{ fontWeight: '800', color: paltaTheme.color.brandPrimary }}>Ver perfil del negocio ›</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: paltaTheme.spacing.xs, padding: paltaTheme.spacing.sm, paddingBottom: paltaTheme.spacing.md, borderTopWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar auto'}
          onPress={() => toggleAutosListingSaved(listing.id)}
          style={{ minWidth: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider }}
        >
          <Text style={{ fontSize: 22, color: saved ? paltaTheme.color.brandPrimary : paltaTheme.color.textPrimary }}>{saved ? '♥' : '♡'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/autos/inquiry/${encodeURIComponent(listing.id)}`)}
          style={({ pressed }) => ({ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: paltaTheme.radius.surface, backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary })}
        >
          <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.surface }}>Consultar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
