import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { AUTOS_DEMO_LISTINGS } from './autosDemoData';
import { VehicleListingCard } from './VehicleListingCard';
import { toggleAutosListingSaved, useAutosDemoState } from './autosDemoState';

const DEALERS: Record<string, { name: string; comuna: string; description: string }> = {
  'demo-business-auto-providencia': {
    name: 'Automotora Providencia · Demo',
    comuna: 'Providencia',
    description: 'Perfil demo de una automotora conectada al canonical Business de Palta.',
  },
  'demo-business-auto-maipu': {
    name: 'Automotora Maipú · Demo',
    comuna: 'Maipú',
    description: 'Inventario profesional demo para validar la conexión Autos ↔ Negocios.',
  },
};

export function AutosDealerDemoScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const demoState = useAutosDemoState();
  const dealer = businessId ? DEALERS[businessId] : undefined;
  const inventory = AUTOS_DEMO_LISTINGS.filter(
    (item) => item.listing.publisherBusinessId === businessId,
  );

  if (!dealer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas, padding: paltaTheme.spacing.xl }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Negocio demo no disponible</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: paltaTheme.spacing.md }}>
          <Text style={{ fontWeight: '800', color: paltaTheme.color.brandPrimary }}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 25, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{dealer.name}</Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>{dealer.comuna}</Text>
          </View>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface, gap: 6 }}>
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.brandSoft }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Negocio verificado · demo</Text>
          </View>
          <Text style={{ fontSize: 14, lineHeight: 20, color: paltaTheme.color.textSecondary }}>{dealer.description}</Text>
          <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
            En producción esta pantalla será el Business Profile canónico de Negocios; Autos sólo referencia su businessId.
          </Text>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Autos publicados</Text>
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{inventory.length}</Text>
          </View>
          {inventory.map((item) => (
            <VehicleListingCard
              key={item.listing.id}
              item={item}
              saved={demoState.savedListingIds.includes(item.listing.id)}
              onToggleSaved={() => toggleAutosListingSaved(item.listing.id)}
              onPress={() => router.push(`/autos/listing/${encodeURIComponent(item.listing.id)}`)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
