import { router } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { AUTOS_DEMO_LISTINGS } from './autosDemoData';
import { toggleAutosListingSaved, useAutosDemoState } from './autosDemoState';
import { VehicleListingCard } from './VehicleListingCard';

export function SavedAutosScreen() {
  const demoState = useAutosDemoState();
  const allListings = [...demoState.publishedListings, ...AUTOS_DEMO_LISTINGS];
  const saved = allListings.filter((item) => demoState.savedListingIds.includes(item.listing.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View>
          <Text style={{ fontSize: 27, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Guardados</Text>
          <Text style={{ marginTop: 3, fontSize: 13, color: paltaTheme.color.textMuted }}>
            {saved.length} {saved.length === 1 ? 'auto guardado' : 'autos guardados'}
          </Text>
        </View>

        {saved.length ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            {saved.map((item) => (
              <VehicleListingCard
                key={item.listing.id}
                item={item}
                saved
                onToggleSaved={() => toggleAutosListingSaved(item.listing.id)}
                onPress={() => router.push(`/autos/listing/${encodeURIComponent(item.listing.id)}`)}
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              padding: paltaTheme.spacing.xl,
              borderRadius: paltaTheme.radius.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
              backgroundColor: paltaTheme.color.surface,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
              Todavía no tienes autos guardados
            </Text>
            <Text style={{ marginTop: 5, fontSize: 13, lineHeight: 19, color: paltaTheme.color.textSecondary }}>
              Guarda vehículos desde la lista o desde su ficha para compararlos después.
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>
          Estado demo compartido con la lista de Autos. Después se persistirá por cuenta Palta.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
